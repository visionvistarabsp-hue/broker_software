import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { issueOtp, verifyOtp, generateOtpCode, hashOtpCode } from "./otp";
import { resetDb } from "@/test/resetDb";

const EMAIL = "otp-user@example.com";

describe("otp", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("issues and verifies a code once (single use)", async () => {
    const code = "123456";
    await prisma.otpChallenge.create({
      data: {
        email: EMAIL,
        purpose: "REGISTER",
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(await verifyOtp(EMAIL, "REGISTER", code)).toEqual({ ok: true });
    expect(await verifyOtp(EMAIL, "REGISTER", code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired code", async () => {
    await prisma.otpChallenge.create({
      data: {
        email: EMAIL,
        purpose: "LOGIN",
        codeHash: hashOtpCode("654321"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await verifyOtp(EMAIL, "LOGIN", "654321")).toEqual({ ok: false, reason: "expired" });
  });

  it("locks out after too many attempts", async () => {
    await prisma.otpChallenge.create({
      data: {
        email: EMAIL,
        purpose: "RESET",
        codeHash: hashOtpCode("111111"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    for (let i = 0; i < 5; i++) await verifyOtp(EMAIL, "RESET", "000000");
    expect(await verifyOtp(EMAIL, "RESET", "111111")).toEqual({ ok: false, reason: "attempts" });
  });

  it("issueOtp stores a hashed challenge", async () => {
    process.env.DEV_OTP_CODE = "";
    await issueOtp(EMAIL, "REGISTER");
    const row = await prisma.otpChallenge.findFirst({
      where: { email: EMAIL, purpose: "REGISTER" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toBeTruthy();
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
