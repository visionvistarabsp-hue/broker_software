import { createHash, randomInt } from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getOtpProvider } from "./otp-provider";

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function issueOtp(phone: string, purpose: OtpPurpose, userId?: string): Promise<void> {
  const env = getEnv();
  const code = env.DEV_OTP_CODE && env.NODE_ENV !== "production" ? env.DEV_OTP_CODE : generateOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otpChallenge.create({
    data: { phone, purpose, userId, codeHash: hashOtpCode(code), expiresAt },
  });
  await getOtpProvider().send(phone, code);
}

export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "attempts" };

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<VerifyResult> {
  const env = getEnv();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "invalid" };
  if (challenge.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (challenge.attemptCount >= env.OTP_MAX_ATTEMPTS) return { ok: false, reason: "attempts" };

  if (challenge.codeHash !== hashOtpCode(code)) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    return updated.attemptCount >= env.OTP_MAX_ATTEMPTS
      ? { ok: false, reason: "attempts" }
      : { ok: false, reason: "invalid" };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
