import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/lib/auth/otp";
import {
  startRegistration,
  completeRegistration,
  finalizePassword,
  consumePasswordSetupToken,
} from "./registration";

const PHONE = "+919990000003";

const hashOf = (t: string) => createHash("sha256").update(t).digest("hex");

async function seedSetupToken(opts?: { expired?: boolean }) {
  const user = await prisma.user.create({
    data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "REFERRAL_BROKER", status: "PENDING" },
  });
  const raw = "a".repeat(64);
  await prisma.passwordSetupToken.create({
    data: {
      tokenHash: hashOf(raw),
      userId: user.id,
      expiresAt: new Date(Date.now() + (opts?.expired ? -1000 : 60000)),
    },
  });
  return { user, raw };
}

describe("registration", () => {
  beforeEach(async () => {
    await prisma.pendingRegistration.deleteMany({ where: { phone: PHONE } });
    await prisma.otpChallenge.deleteMany({ where: { phone: PHONE } });
    await prisma.passwordSetupToken.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
    await prisma.session.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
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
    const tokenHash = hashOf(res.data.token);
    const setup = await prisma.passwordSetupToken.findUnique({ where: { tokenHash } });
    expect(setup).toBeTruthy();
    const user = await prisma.user.findUnique({ where: { id: setup!.userId }, include: { brokerProfile: true } });
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

  it("consumes a setup token exactly once and maps it to the user", async () => {
    const { user, raw } = await seedSetupToken();
    expect(await consumePasswordSetupToken(raw)).toEqual({ userId: user.id });
    expect(await consumePasswordSetupToken(raw)).toBeNull();
  });

  it("rejects an expired setup token", async () => {
    const { raw } = await seedSetupToken({ expired: true });
    expect(await consumePasswordSetupToken(raw)).toBeNull();
  });

  it("rejects an unknown or empty setup token", async () => {
    expect(await consumePasswordSetupToken("deadbeef")).toBeNull();
    expect(await consumePasswordSetupToken("")).toBeNull();
  });

  it("refuses to finalize a password for an account that already has one", async () => {
    const { user, raw } = await seedSetupToken();
    const first = await finalizePassword(user.id, "Str0ngPassw0rd");
    expect(first.ok).toBe(true);
    const second = await finalizePassword(user.id, "AnotherStr0ng1");
    expect(second.ok).toBe(false);
    expect(await consumePasswordSetupToken(raw)).toBeNull();
  });
});
