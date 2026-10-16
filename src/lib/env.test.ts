import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  APP_URL: "http://localhost:3000",
  SESSION_COOKIE_NAME: "broker_session",
  SESSION_TTL_HOURS: "720",
  OTP_TTL_MINUTES: "10",
  OTP_MAX_ATTEMPTS: "5",
  OTP_PROVIDER: "console",
  SMTP_URL: "",
  SMTP_FROM: "no-reply@example.com",
};

describe("parseEnv", () => {
  it("parses valid env", () => {
    const e = parseEnv(base as unknown as NodeJS.ProcessEnv);
    expect(e.SESSION_TTL_HOURS).toBe(720);
    expect(e.OTP_PROVIDER).toBe("console");
  });

  it("rejects console OTP provider in production", () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv)
    ).toThrow(
      /OTP_PROVIDER/
    );
  });

  it("rejects invalid OTP_PROVIDER", () => {
    expect(() =>
      parseEnv({ ...base, OTP_PROVIDER: "sms" } as unknown as NodeJS.ProcessEnv)
    ).toThrow();
  });
});

describe("assertOtpProviderUsable", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://x:y@localhost:5432/z",
    APP_URL: "http://localhost:3000",
    SESSION_COOKIE_NAME: "broker_session",
    SESSION_TTL_HOURS: "720",
    OTP_TTL_MINUTES: "10",
    OTP_MAX_ATTEMPTS: "5",
    OTP_PROVIDER: "console",
    SMTP_URL: "",
    SMTP_FROM: "no-reply@example.com",
  } as unknown as NodeJS.ProcessEnv;

  it("throws when NODE_ENV=production + OTP_PROVIDER=console", async () => {
    const { assertOtpProviderUsable, resetEnvCache } = await import("./env");
    const prev = { ...process.env };
    process.env = { ...process.env, ...baseEnv, NODE_ENV: "production", OTP_PROVIDER: "console" } as NodeJS.ProcessEnv;
    resetEnvCache();
    expect(() => assertOtpProviderUsable()).toThrow("OTP_PROVIDER=console is not allowed in production; configure SMTP.");
    process.env = prev;
  });

  it("does not throw for default/console-dev config", async () => {
    const { assertOtpProviderUsable, resetEnvCache } = await import("./env");
    const prev = { ...process.env };
    process.env = { ...process.env, ...baseEnv, NODE_ENV: "development", OTP_PROVIDER: "console" } as NodeJS.ProcessEnv;
    resetEnvCache();
    expect(() => assertOtpProviderUsable()).not.toThrow();
    process.env = prev;
  });
});
