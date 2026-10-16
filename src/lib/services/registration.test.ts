import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/lib/auth/otp";
import { startRegistration, completeRegistration, finalizePassword } from "./registration";

const PHONE = "+919990000003";

describe("registration", () => {
  beforeEach(async () => {
    await prisma.pendingRegistration.deleteMany({ where: { phone: PHONE } });
    await prisma.otpChallenge.deleteMany({ where: { phone: PHONE } });
    await prisma.brokerProfile.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
    await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  });

  it("starts registration and stores pending row", async () => {
    process.env.DEV_OTP_CODE = "222333";
    const res = await startRegistration({
      fullName: "Asha Rao", phone: PHONE, role: "REFERRAL_BROKER", consent: true, email: "",
    });
    expect(res.ok).toBe(true);
    const pending = await prisma.pendingRegistration.findUnique({ where: { phone: PHONE } });
    expect(pending?.role).toBe("REFERRAL_BROKER");
  });

  it("completes registration with valid OTP and assigns a broker code", async () => {
    await prisma.pendingRegistration.create({
      data: { phone: PHONE, fullName: "Asha Rao", role: "REFERRAL_BROKER", consentAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "REGISTER", codeHash: hashOtpCode("222333"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeRegistration({ phone: PHONE, purpose: "REGISTER", code: "222333" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const user = await prisma.user.findUnique({ where: { id: res.data.userId }, include: { brokerProfile: true } });
    expect(user?.status).toBe("PENDING");
    expect(user?.brokerProfile?.brokerCode).toHaveLength(10);
    expect(await prisma.pendingRegistration.findUnique({ where: { phone: PHONE } })).toBeNull();
  });

  it("rejects an invalid OTP", async () => {
    await prisma.pendingRegistration.create({
      data: { phone: PHONE, fullName: "Asha Rao", role: "REFERRAL_BROKER", consentAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "REGISTER", codeHash: hashOtpCode("222333"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeRegistration({ phone: PHONE, purpose: "REGISTER", code: "999999" });
    expect(res.ok).toBe(false);
  });

  it("finalizes password and returns a session", async () => {
    const u = await prisma.user.create({
      data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "REFERRAL_BROKER", status: "PENDING" },
    });
    const res = await finalizePassword(u.id, "Str0ngPassw0rd");
    expect(res.ok).toBe(true);
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordHash).toBeTruthy();
  });
});
