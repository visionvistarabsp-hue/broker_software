import "dotenv/config";

(process.env as Record<string, string>).NODE_ENV = "test";

// Tests must never talk to a real SMTP server or send real OTPs.
// The console provider is hard-blocked in production, so this is safe.
if (process.env.OTP_PROVIDER !== "console") {
  process.env.OTP_PROVIDER = "console";
}
