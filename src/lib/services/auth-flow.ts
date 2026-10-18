import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, revokeAllForUser, revokeSession } from "@/lib/auth/session";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";

type SessionPayload = { token: string; expiresAt: Date };

async function findUserByIdentifier(identifier: string) {
  return prisma.user.findFirst({
    where: { email: identifier.toLowerCase() },
    include: { brokerProfile: true },
  });
}

export async function loginWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<ActionResult<SessionPayload>> {
  const user = await findUserByIdentifier(input.identifier.trim());
  if (!user || !user.passwordHash) return actionError("Invalid credentials.");
  if (user.status === "SUSPENDED") return actionError("Your account is suspended. Contact an admin.");
  if (user.status === "DEACTIVATED") return actionError("Your account is deactivated.");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) return actionError("Invalid credentials.");
  await revokeAllForUser(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id);
  return actionSuccess(session);
}

export async function requestLoginOtp(email: string): Promise<ActionResult<{ email: string }>> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return actionError("No account found for this email address.");
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    return actionError("This account cannot log in. Contact an admin.");
  }
  try {
    await issueOtp(email.toLowerCase(), "LOGIN", user.id);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Unable to send code.");
  }
  return actionSuccess({ email: email.toLowerCase() });
}

export async function completeLoginOtp(email: string, code: string): Promise<ActionResult<SessionPayload>> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return actionError("No account found for this email address.");
  if (user.status !== "ACTIVE") return actionError("This account cannot log in yet.");
  const result = await verifyOtp(email.toLowerCase(), "LOGIN", code);
  if (!result.ok) return actionError("Invalid or expired code.");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id);
  return actionSuccess(session);
}

export async function logout(token: string): Promise<void> {
  await revokeSession(token);
}

export async function requestPasswordReset(email: string): Promise<ActionResult<{ email: string }>> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    try {
      await issueOtp(email.toLowerCase(), "RESET", user.id);
    } catch (e) {
      return actionError(e instanceof Error ? e.message : "Unable to send code.");
    }
  }
  return actionSuccess({ email: email.toLowerCase() });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<ActionResult<{ ok: true }>> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return actionError("Invalid request.");
  const result = await verifyOtp(email.toLowerCase(), "RESET", code);
  if (!result.ok) return actionError("Invalid or expired code.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await revokeAllForUser(user.id);
  return actionSuccess({ ok: true });
}
