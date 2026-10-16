import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashOtpCode } from "@/lib/auth/otp";
import { loginWithPassword, completeLoginOtp, resetPassword } from "./auth-flow";

const PHONE = "+919990000004";

async function seedUser(status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  return prisma.user.create({
    data: {
      phoneOriginal: PHONE, phoneNormalized: PHONE, email: "u4@example.com",
      role: "MAIN_BROKER", status, passwordHash: await hashPassword("Str0ngPassw0rd"),
    },
  });
}

describe("auth-flow", () => {
  beforeEach(async () => { await prisma.session.deleteMany(); await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } }); });

  it("logs in with phone + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: PHONE, password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("logs in with email + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: "u4@example.com", password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("rejects wrong password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: PHONE, password: "nope" });
    expect(res.ok).toBe(false);
  });

  it("rejects suspended accounts", async () => {
    await seedUser("SUSPENDED");
    const res = await loginWithPassword({ identifier: PHONE, password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(false);
  });

  it("completes OTP login for an active user", async () => {
    await seedUser();
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "LOGIN", codeHash: hashOtpCode("445566"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeLoginOtp(PHONE, "445566");
    expect(res.ok).toBe(true);
  });

  it("resets password and revokes sessions", async () => {
    const u = await seedUser();
    const s = await prisma.session.create({ data: { userId: u.id, tokenHash: "t1", expiresAt: new Date(Date.now() + 1e6) } });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "RESET", codeHash: hashOtpCode("778899"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await resetPassword(PHONE, "778899", "NewStr0ngPass");
    expect(res.ok).toBe(true);
    const after = await prisma.session.findUnique({ where: { id: s.id } });
    expect(after?.revokedAt).not.toBeNull();
  });
});
