import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export interface OtpProvider {
  readonly name: string;
  send(email: string, code: string): Promise<void>;
}

class ConsoleOtpProvider implements OtpProvider {
  readonly name = "console";
  async send(email: string, code: string): Promise<void> {
    if (getEnv().NODE_ENV === "production") {
      throw new Error("Console OTP provider must never run in production.");
    }
    console.log(`[DEV OTP] ${email} -> ${code}`);
  }
}

class SmtpOtpProvider implements OtpProvider {
  readonly name = "smtp";
  async send(email: string, code: string): Promise<void> {
    const env = getEnv();
    if (!env.SMTP_URL) throw new Error("SMTP is not configured (SMTP_URL missing).");
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: "Your verification code",
      text: `Your verification code is ${code}. It expires soon. Do not share it.`,
    });
  }
}

export function getOtpProvider(): OtpProvider {
  const env = getEnv();
  if (env.NODE_ENV === "production" || env.OTP_PROVIDER === "smtp") {
    return new SmtpOtpProvider();
  }
  return new ConsoleOtpProvider();
}
