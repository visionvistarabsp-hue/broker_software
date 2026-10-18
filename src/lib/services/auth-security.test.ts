import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/lib/auth/otp";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, validateSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

const EMAIL = "auth-security@example.com";

describe("auth security", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.otpChallenge.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("OTP cannot be reused after success", async () => {
    await prisma.otpChallenge.create({ data: { email: EMAIL, purpose: "LOGIN", codeHash: hashOtpCode("101010"), expiresAt: new Date(Date.now() + 60000) } });
    expect((await verifyOtp(EMAIL, "LOGIN", "101010")).ok).toBe(true);
    expect((await verifyOtp(EMAIL, "LOGIN", "101010")).ok).toBe(false);
  });

  it("expired OTP is rejected", async () => {
    await prisma.otpChallenge.create({ data: { email: EMAIL, purpose: "LOGIN", codeHash: hashOtpCode("101010"), expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifyOtp(EMAIL, "LOGIN", "101010")).toEqual({ ok: false, reason: "expired" });
  });

  it("suspended users cannot use existing sessions", async () => {
    const u = await prisma.user.create({ data: { email: EMAIL, role: "MAIN_BROKER", status: "ACTIVE", passwordHash: await hashPassword("Str0ngPassw0rd") } });
    const { token } = await createSession(u.id);
    expect(await validateSession(token)).not.toBeNull();
    await prisma.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    expect(await validateSession(token)).toBeNull();
  });
});
