import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashOtpCode } from "@/lib/auth/otp";
import { loginWithPassword, completeLoginOtp, resetPassword } from "./auth-flow";
import { resetDb } from "@/test/resetDb";

const EMAIL = "u4@example.com";

async function seedUser(status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  return prisma.user.create({
    data: {
      email: EMAIL, role: "MAIN_BROKER", status,
      passwordHash: await hashPassword("Str0ngPassw0rd"),
    },
  });
}

describe("auth-flow", () => {
  beforeEach(async () => { await resetDb(); });

  it("logs in with a case-insensitive email + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: "U4@EXAMPLE.COM", password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("logs in with email + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: "u4@example.com", password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("rejects wrong password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: EMAIL, password: "nope" });
    expect(res.ok).toBe(false);
  });

  it("rejects suspended accounts", async () => {
    await seedUser("SUSPENDED");
    const res = await loginWithPassword({ identifier: EMAIL, password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(false);
  });

  it("completes OTP login for an active user", async () => {
    await seedUser();
    await prisma.otpChallenge.create({
      data: { email: EMAIL, purpose: "LOGIN", codeHash: hashOtpCode("445566"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeLoginOtp(EMAIL, "445566");
    expect(res.ok).toBe(true);
  });

  it("resets password and revokes sessions", async () => {
    const u = await seedUser();
    const s = await prisma.session.create({ data: { userId: u.id, tokenHash: "t1", expiresAt: new Date(Date.now() + 1e6) } });
    await prisma.otpChallenge.create({
      data: { email: EMAIL, purpose: "RESET", codeHash: hashOtpCode("778899"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await resetPassword(EMAIL, "778899", "NewStr0ngPass");
    expect(res.ok).toBe(true);
    const after = await prisma.session.findUnique({ where: { id: s.id } });
    expect(after?.revokedAt).not.toBeNull();
  });
});
