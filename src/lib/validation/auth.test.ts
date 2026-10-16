import { describe, it, expect } from "vitest";
import { registerSchema, setPasswordSchema, loginSchema } from "./auth";

describe("validation", () => {
  it("registerSchema normalizes phone and requires consent", () => {
    const r = registerSchema.safeParse({
      fullName: "Asha Rao",
      phone: "+91 98765 43210",
      role: "REFERRAL_BROKER",
      consent: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("+919876543210");
  });

  it("registerSchema rejects missing consent", () => {
    const r = registerSchema.safeParse({ fullName: "A", phone: "9876543210", role: "MAIN_BROKER", consent: false });
    expect(r.success).toBe(false);
  });

  it("setPasswordSchema enforces policy", () => {
    expect(setPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: "Str0ngPassw0rd", confirm: "Str0ngPassw0rd" }).success).toBe(true);
  });

  it("loginSchema accepts identifier + password", () => {
    expect(loginSchema.safeParse({ identifier: "919876543210", password: "Str0ngPassw0rd" }).success).toBe(true);
  });
});
