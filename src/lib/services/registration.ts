import { prisma } from "@/lib/db";
import { generateUniqueCode } from "@/lib/services/codes";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllForUser, createSession } from "@/lib/auth/session";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";
import type { RegisterInput } from "@/lib/validation/auth";
import type { OtpPurpose } from "@prisma/client";

const PENDING_TTL_MS = 30 * 60 * 1000;

export async function startRegistration(input: RegisterInput): Promise<ActionResult<{ phone: string }>> {
  const existing = await prisma.user.findUnique({ where: { phoneNormalized: input.phone } });
  if (existing) return actionError("An account with this phone number already exists.");
  await prisma.pendingRegistration.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      fullName: input.fullName,
      email: input.email || null,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
    update: {
      fullName: input.fullName,
      email: input.email || null,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  try {
    await issueOtp(input.phone, "REGISTER");
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Unable to send verification code.");
  }
  return actionSuccess({ phone: input.phone });
}

export interface CompleteRegistrationInput {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}

export async function completeRegistration(
  input: CompleteRegistrationInput
): Promise<ActionResult<{ userId: string }>> {
  const pending = await prisma.pendingRegistration.findUnique({ where: { phone: input.phone } });
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    return actionError("Your registration session expired. Please start again.");
  }
  const result = await verifyOtp(input.phone, input.purpose, input.code);
  if (!result.ok) return actionError("Invalid or expired verification code.");

  const existing = await prisma.user.findUnique({ where: { phoneNormalized: input.phone } });
  if (existing) return actionError("An account with this phone number already exists.");

  const user = await prisma.$transaction(async (tx) => {
    const code = await generateUniqueCode(async (c) =>
      !!(await tx.brokerProfile.findUnique({ where: { brokerCode: c } }))
    );
    const created = await tx.user.create({
      data: {
        phoneOriginal: input.phone,
        phoneNormalized: input.phone,
        email: pending.email,
        role: pending.role,
        status: "PENDING",
        phoneVerifiedAt: new Date(),
        consentAt: pending.consentAt,
      },
    });
    await tx.brokerProfile.create({
      data: { userId: created.id, brokerCode: code, fullName: pending.fullName },
    });
    await tx.pendingRegistration.delete({ where: { phone: input.phone } });
    return created;
  });

  return actionSuccess({ userId: user.id });
}

export async function finalizePassword(
  userId: string,
  password: string
): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllForUser(userId);
  const session = await createSession(userId);
  return actionSuccess(session);
}
