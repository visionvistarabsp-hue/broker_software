"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerSchema, verifyOtpSchema, setPasswordSchema, loginSchema, resetConfirmSchema } from "@/lib/validation/auth";
import { zodFieldErrors, actionError, type ActionResult } from "@/lib/validation/common";
import { startRegistration, completeRegistration, consumePasswordSetupToken, finalizePassword } from "@/lib/services/registration";
import {
  loginWithPassword, completeLoginOtp, logout, requestLoginOtp, requestPasswordReset, resetPassword,
} from "@/lib/services/auth-flow";
import { setSessionCookie, clearSessionCookie, readSessionToken } from "@/lib/auth/cookies";

export async function registerAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
    consent: formData.get("consent") === "on" || formData.get("consent") === "true",
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  return startRegistration(parsed.data);
}

export async function verifyOtpAction(formData: FormData): Promise<ActionResult<{ token: string }>> {
  const parsed = verifyOtpSchema.safeParse({
    email: formData.get("email"),
    purpose: "REGISTER",
    code: formData.get("code"),
  });
  if (!parsed.success) return actionError("Invalid code.", zodFieldErrors(parsed.error));
  return completeRegistration({ email: parsed.data.email, purpose: "REGISTER", code: parsed.data.code });
}

export async function setPasswordAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  const setup = await consumePasswordSetupToken(parsed.data.token);
  if (!setup) return actionError("This setup link is invalid or has expired.");
  const res = await finalizePassword(setup.userId, parsed.data.password);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function loginAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return actionError("Enter your credentials.", zodFieldErrors(parsed.error));
  const res = await loginWithPassword(parsed.data);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function otpLoginAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const email = String(formData.get("email") ?? "");
  if (!email || !email.includes("@")) return actionError("Enter a valid email address.");
  return requestLoginOtp(email.toLowerCase());
}

export async function completeOtpLoginAction(email: string, code: string): Promise<ActionResult<{ ok: true }>> {
  const res = await completeLoginOtp(email.toLowerCase(), code);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function resetRequestAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const email = String(formData.get("email") ?? "");
  if (!email || !email.includes("@")) return actionError("Enter a valid email address.");
  return requestPasswordReset(email.toLowerCase());
}

export async function resetConfirmAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = resetConfirmSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  const res = await resetPassword(parsed.data.email.toLowerCase(), parsed.data.code, parsed.data.password);
  if (!res.ok) return res;
  return { ok: true, data: { ok: true } };
}
