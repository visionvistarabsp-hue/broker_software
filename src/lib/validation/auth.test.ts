import { describe, it, expect } from "vitest";
import { registerSchema, setPasswordSchema, loginSchema } from "./auth";

describe("validation", () => {
  it("registerSchema accepts an email and requires consent", () => {
    const r = registerSchema.safeParse({
      fullName: "Asha Rao",
      email: "asha@example.com",
      role: "REFERRAL_BROKER",
      consent: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("asha@example.com");
  });

  it("registerSchema rejects missing consent", () => {
    const r = registerSchema.safeParse({ fullName: "A", email: "a@example.com", role: "MAIN_BROKER", consent: false });
    expect(r.success).toBe(false);
  });

  it("setPasswordSchema enforces policy", () => {
    expect(setPasswordSchema.safeParse({ token: "u1", password: "short", confirm: "short" }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ token: "u1", password: "Str0ngPassw0rd", confirm: "Str0ngPassw0rd" }).success).toBe(true);
  });

  it("loginSchema accepts identifier + password", () => {
    expect(loginSchema.safeParse({ identifier: "919876543210", password: "Str0ngPassw0rd" }).success).toBe(true);
  });
});
