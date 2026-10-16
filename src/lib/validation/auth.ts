import { z } from "zod";
import { normalizePhone } from "@/lib/services/phone";

export const normalizedPhoneField = z
  .string()
  .min(1, "Phone number is required")
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: normalizedPhoneField,
  email: z.union([z.string().email(), z.literal("")]).optional(),
  role: z.enum(["MAIN_BROKER", "REFERRAL_BROKER"]),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(["REGISTER", "LOGIN", "RESET"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  role: z.enum(["MAIN_BROKER", "REFERRAL_BROKER"]).optional(),
  fullName: z.string().optional(),
});

const passwordObject = z.object({
  token: z.string().min(1),
  password: z.string().min(10, "At least 10 characters"),
  confirm: z.string().min(1),
});

const withPasswordRules = <T extends z.ZodType<{ password: string; confirm: string }>>(schema: T) =>
  schema
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" })
    .refine((d) => /[A-Za-z]/.test(d.password) && /[0-9]/.test(d.password), {
      path: ["password"],
      message: "Include a letter and a digit",
    });

export const setPasswordSchema = withPasswordRules(passwordObject);

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

export const otpLoginRequestSchema = z.object({ phone: normalizedPhoneField });

export const resetRequestSchema = z.object({ phone: normalizedPhoneField });

export const resetConfirmSchema = withPasswordRules(
  passwordObject.omit({ token: true }).extend({
    phone: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
  })
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;