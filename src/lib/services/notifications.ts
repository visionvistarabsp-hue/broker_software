import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";
import { writeAudit } from "@/lib/services/audit";

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  type: string;
  readAt: Date | null;
  createdAt: Date;
  linkHref: string | null;
}

function scopeNotificationWhere(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  return { userId: actor.id };
}

export async function unreadCount(actor: SessionUser): Promise<number> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  return prisma.notification.count({
    where: { ...scopeNotificationWhere(actor), readAt: null },
  });
}

export async function listNotifications(
  actor: SessionUser,
  opts?: { unreadOnly?: boolean; take?: number },
): Promise<NotificationRow[]> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const where: Record<string, unknown> = { ...scopeNotificationWhere(actor) };
  if (opts?.unreadOnly) where.readAt = null;

  const rows = await prisma.notification.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    take: opts?.take,
  });

  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    readAt: n.readAt,
    createdAt: n.createdAt,
    linkHref: n.leadId ? `/leads/${n.leadId}` : "/notifications",
  }));
}

export async function markRead(actor: SessionUser, id: string): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new AuthError(404, "Notification not found");

  if (actor.role !== "ADMIN" && notification.userId !== actor.id) {
    throw new AuthError(403, "Forbidden");
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "NOTIFICATION_READ",
    targetType: "Notification",
    targetId: id,
  });
}

export async function markAllRead(actor: SessionUser): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  await prisma.notification.updateMany({
    where: { ...scopeNotificationWhere(actor), readAt: null },
    data: { readAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "NOTIFICATIONS_MARK_ALL_READ",
    targetType: "Notification",
  });
}
