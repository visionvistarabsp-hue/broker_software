import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { Role, UserStatus } from "@prisma/client";

export interface SessionUser {
  id: string;
  role: Role;
  status: UserStatus;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function expiryFromNow(): Date {
  const hours = getEnv().SESSION_TTL_HOURS;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function createSession(userId: string, meta: SessionMeta = {}) {
  const token = newToken();
  const expiresAt = expiryFromNow();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<{ user: SessionUser } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  const { user } = session;
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") return null;
  return { user: { id: user.id, role: user.role, status: user.status } };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateSession(oldToken: string, meta: SessionMeta = {}) {
  const old = await prisma.session.findUnique({ where: { tokenHash: hashToken(oldToken) } });
  if (!old || old.revokedAt || old.expiresAt.getTime() < Date.now()) {
    throw new Error("Cannot rotate an invalid session");
  }
  const token = newToken();
  const expiresAt = expiryFromNow();
  await prisma.$transaction([
    prisma.session.update({ where: { id: old.id }, data: { revokedAt: new Date() } }),
    prisma.session.create({
      data: {
        userId: old.userId,
        tokenHash: hashToken(token),
        expiresAt,
        rotatedFromId: old.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);
  return { token, expiresAt };
}
