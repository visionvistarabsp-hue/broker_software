import type { Role, UserStatus } from "@prisma/client";
import { readSessionToken } from "@/lib/auth/cookies";
import { validateSession, type SessionUser } from "@/lib/auth/session";

export type { SessionUser };

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

interface LeadScope {
  id: string;
  submittedById: string;
  assignedToId: string | null;
}

export function requireRoleOf(user: SessionUser, roles: Role[]): SessionUser {
  if (!roles.includes(user.role)) throw new AuthError(403, "Forbidden");
  return user;
}

export function canAccessLead(user: SessionUser, lead: LeadScope): boolean {
  if (user.role === "ADMIN") return true;
  return lead.submittedById === user.id || lead.assignedToId === user.id;
}

export function scopeLeadWhere(user: SessionUser): Record<string, unknown> {
  if (user.role === "ADMIN") return {};
  return { OR: [{ submittedById: user.id }, { assignedToId: user.id }] };
}

export function assertSameBrokerOrAdmin(user: SessionUser, ownerId: string | null): void {
  if (user.role === "ADMIN") return;
  if (ownerId === user.id) return;
  throw new AuthError(403, "Forbidden");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const result = await validateSession(token);
  return result?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Authentication required");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  return requireRoleOf(user, roles);
}

export function isActive(status: UserStatus): boolean {
  return status === "ACTIVE";
}
