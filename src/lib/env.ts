import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url(),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce.number().int().positive(),
  OTP_TTL_MINUTES: z.coerce.number().int().positive(),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive(),
  OTP_PROVIDER: z.enum(["console", "smtp"]),
  SMTP_URL: z.string().default(""),
  SMTP_FROM: z.string().default("no-reply@example.com"),
  DEV_OTP_CODE: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.parse(source);
  if (parsed.NODE_ENV === "production" && parsed.OTP_PROVIDER === "console") {
    throw new Error("OTP_PROVIDER=console is not allowed in production; configure SMTP.");
  }
  if (parsed.NODE_ENV === "production" && parsed.OTP_PROVIDER === "smtp" && !parsed.SMTP_URL) {
    throw new Error("OTP_PROVIDER=smtp requires SMTP_URL in production.");
  }
  return parsed;
}

let cached: Env | undefined;
export function getEnv(): Env {
  if (!cached) cached = parseEnv();
  return cached;
}
export const env = getEnv();
