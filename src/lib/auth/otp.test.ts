import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { issueOtp, verifyOtp, generateOtpCode, hashOtpCode } from "./otp";

const PHONE = "+919990000002";

describe("otp", () => {
  beforeAll(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone: { startsWith: "+91999" } } });
  });

  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("issues and verifies a code once (single use)", async () => {
    const code = "123456";
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "REGISTER",
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(await verifyOtp(PHONE, "REGISTER", code)).toEqual({ ok: true });
    expect(await verifyOtp(PHONE, "REGISTER", code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired code", async () => {
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "LOGIN",
        codeHash: hashOtpCode("654321"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await verifyOtp(PHONE, "LOGIN", "654321")).toEqual({ ok: false, reason: "expired" });
  });

  it("locks out after too many attempts", async () => {
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "RESET",
        codeHash: hashOtpCode("111111"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    for (let i = 0; i < 5; i++) await verifyOtp(PHONE, "RESET", "000000");
    expect(await verifyOtp(PHONE, "RESET", "111111")).toEqual({ ok: false, reason: "attempts" });
  });

  it("issueOtp stores a hashed challenge", async () => {
    process.env.DEV_OTP_CODE = "";
    await issueOtp(PHONE, "REGISTER");
    const row = await prisma.otpChallenge.findFirst({
      where: { phone: PHONE, purpose: "REGISTER" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toBeTruthy();
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
