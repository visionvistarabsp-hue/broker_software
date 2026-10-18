import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { generateUniqueCode } from "@/lib/services/codes";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { createSession, hashToken } from "@/lib/auth/session";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";
import type { RegisterInput } from "@/lib/validation/auth";
import type { OtpPurpose } from "@prisma/client";

const PENDING_TTL_MS = 30 * 60 * 1000;
const SETUP_TTL_MS = 15 * 60 * 1000;

export async function startRegistration(input: RegisterInput): Promise<ActionResult<{ email: string }>> {
  const existing = await prisma.user.findUnique({ where: { email: input.email || undefined } });
  if (existing) return actionError("An account with this email already exists.");
  await prisma.pendingRegistration.upsert({
    where: { email: input.email || "" },
    create: {
      email: input.email || "",
      fullName: input.fullName,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
    update: {
      fullName: input.fullName,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  try {
    await issueOtp(input.email || "", "REGISTER");
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Unable to send verification code.");
  }
  return actionSuccess({ email: input.email || "" });
}

export interface CompleteRegistrationInput {
  email: string;
  purpose: OtpPurpose;
  code: string;
}

export async function completeRegistration(
  input: CompleteRegistrationInput
): Promise<ActionResult<{ token: string }>> {
  const pending = await prisma.pendingRegistration.findUnique({ where: { email: input.email } });
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    return actionError("Your registration session expired. Please start again.");
  }
  const result = await verifyOtp(input.email, input.purpose, input.code);
  if (!result.ok) return actionError("Invalid or expired verification code.");

  const existing = await prisma.user.findUnique({ where: { email: input.email || undefined } });
  if (existing) return actionError("An account with this email already exists.");

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SETUP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const code = await generateUniqueCode(async (c) =>
      !!(await tx.brokerProfile.findUnique({ where: { brokerCode: c } }))
    );
    const created = await tx.user.create({
      data: {
        email: input.email || null,
        role: pending.role,
        status: "PENDING",
        emailVerifiedAt: new Date(),
        consentAt: pending.consentAt,
      },
    });
    await tx.brokerProfile.create({
      data: { userId: created.id, brokerCode: code, fullName: pending.fullName },
    });
    await tx.passwordSetupToken.create({
      data: { tokenHash, userId: created.id, expiresAt },
    });
    await tx.pendingRegistration.delete({ where: { email: input.email } });
  });

  return actionSuccess({ token: rawToken });
}

export async function consumePasswordSetupToken(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const record = await prisma.passwordSetupToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  const consumed = await prisma.passwordSetupToken.updateMany({
    where: { tokenHash, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return null;
  return { userId: record.userId };
}

export async function finalizePassword(
  userId: string,
  password: string
): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return actionError("Account not found.");
  if (user.passwordHash) return actionError("This account already has a password set.");

  const passwordHash = await hashPassword(password);

  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, passwordHash: null },
      data: { passwordHash },
    });
    if (updated.count !== 1) return false;
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.passwordSetupToken.deleteMany({ where: { userId } });
    return true;
  });

  if (!applied) return actionError("This account already has a password set.");

  const session = await createSession(userId);
  return actionSuccess(session);
}
