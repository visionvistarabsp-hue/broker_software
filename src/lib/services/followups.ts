import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";

import { writeAudit } from "@/lib/services/audit";

export type FollowUpScope = "today" | "upcoming" | "overdue" | "all";

export interface FollowUpLeadRef {
  id: string;
  leadCode: string;
  customer: { fullName: string } | null;
}

export interface FollowUpRow {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  dueAt: Date;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | string;
  assignedToId: string | null;
  isOverdue: boolean;
  lead: FollowUpLeadRef | null;
}

export interface CreateFollowUpInput {
  leadId?: string;
  title?: string;
  description?: string;
  dueAt?: string | Date;
  priority?: string;
  assignedToId?: string;
}

function scopeFollowUpWhere(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  return { OR: [{ createdById: actor.id }, { assignedToId: actor.id }] };
}

export async function listFollowUps(
  actor: SessionUser,
  opts?: { scope?: FollowUpScope; from?: Date; to?: Date },
): Promise<FollowUpRow[]> {
  // Non-ACTIVE (e.g. PENDING) users may browse; return empty rather than crash.
  if (actor.status !== "ACTIVE") return [];
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const now = new Date();
  const where: Record<string, unknown> = { ...scopeFollowUpWhere(actor) };

  if (opts?.from || opts?.to) {
    const dateFilter: Record<string, unknown> = {};
    if (opts.from) dateFilter.gte = opts.from;
    if (opts.to) dateFilter.lte = opts.to;
    where.dueAt = dateFilter as never;
  }

  if (opts?.scope === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    where.dueAt = { gte: start, lte: end } as never;
  } else if (opts?.scope === "upcoming") {
    where.dueAt = { gt: now } as never;
    where.status = "PENDING";
  } else if (opts?.scope === "overdue") {
    where.dueAt = { lt: now } as never;
    where.status = "PENDING";
  }

  const rows = await prisma.followUp.findMany({
    where: where as never,
    orderBy: { dueAt: "asc" },
    include: {
      lead: {
        include: {
          customer: { select: { fullName: true } },
        },
      },
    },
  });

  return rows.map((f) => ({
    id: f.id,
    leadId: f.leadId,
    title: f.title,
    description: f.description,
    dueAt: f.dueAt,
    priority: f.priority,
    status: f.status,
    assignedToId: f.assignedToId,
    isOverdue: f.status === "PENDING" && f.dueAt < now,
    lead: f.lead
      ? {
          id: f.lead.id,
          leadCode: f.lead.leadCode,
          customer: f.lead.customer
            ? { fullName: f.lead.customer.fullName }
            : null,
        }
      : null,
  }));
}





export async function createFollowUp(
  actor: SessionUser,
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (actor.status !== "ACTIVE") return { ok: false, error: "Account is not active." };
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const raw = input as CreateFollowUpInput;
  const leadId = raw.leadId?.trim();
  const title = raw.title?.trim();
  const description = raw.description?.trim() || null;
  const dueAt = raw.dueAt ? new Date(raw.dueAt) : null;
  const priority = (raw.priority === "LOW" || raw.priority === "HIGH" || raw.priority === "URGENT" || raw.priority === "MEDIUM")
    ? raw.priority
    : "MEDIUM";
  const assignedToId = raw.assignedToId?.trim() || null;

  if (!leadId) return { ok: false, error: "Lead is required." };
  if (!title) return { ok: false, error: "Title is required." };
  if (!dueAt) return { ok: false, error: "Due date is required." };

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { customer: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };

  if (actor.role !== "ADMIN") {
    const canAccess = lead.submittedById === actor.id || lead.assignedToId === actor.id;
    if (!canAccess) return { ok: false, error: "Forbidden: you do not have access to this lead." };
  }

  if (assignedToId && assignedToId !== actor.id && actor.role !== "ADMIN") {
    const target = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!target || target.status !== "ACTIVE") {
      return { ok: false, error: "Assignee is not an active broker." };
    }
  }

  const followUp = await prisma.followUp.create({
    data: {
      leadId,
      title,
      description,
      dueAt,
      priority,
      assignedToId,
      createdById: actor.id,
      rescheduleHistory: [],
    },
  });

  const notifyUserId = assignedToId || lead.submittedById;
  if (notifyUserId && notifyUserId !== actor.id) {
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: "FOLLOWUP_DUE",
        title: `New follow-up: ${title}`,
        body: `Due ${dueAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}`,
        leadId,
        dedupeKey: `followup-due-${followUp.id}`,
      },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "FOLLOWUP_CREATED",
    targetType: "FollowUp",
    targetId: followUp.id,
    summary: `Lead ${lead.leadCode}: ${title}`,
  });

  return { ok: true };
}

export async function completeFollowUp(actor: SessionUser, id: string): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!followUp) throw new AuthError(404, "Follow-up not found");

  if (actor.role !== "ADMIN") {
    const canAccess = followUp.createdById === actor.id || followUp.assignedToId === actor.id;
    if (!canAccess) throw new AuthError(403, "Forbidden");
  }

  await prisma.followUp.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await writeAudit({
    actorId: actor.id,
    action: "FOLLOWUP_COMPLETED",
    targetType: "FollowUp",
    targetId: id,
    summary: `Lead ${followUp.lead.leadCode}: ${followUp.title}`,
  });
}

export async function rescheduleFollowUp(
  actor: SessionUser,
  id: string,
  input: { newDueAt?: string | Date; reason?: string },
): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!followUp) throw new AuthError(404, "Follow-up not found");

  if (actor.role !== "ADMIN") {
    const canAccess = followUp.createdById === actor.id || followUp.assignedToId === actor.id;
    if (!canAccess) throw new AuthError(403, "Forbidden");
  }

  const newDueAt = input.newDueAt ? new Date(input.newDueAt) : null;
  if (!newDueAt) throw new AuthError(400, "New due date is required.");

  const history = (followUp.rescheduleHistory as unknown[]) ?? [];
  history.push({
    from: followUp.dueAt,
    to: newDueAt,
    reason: input.reason?.trim() || null,
    changedById: actor.id,
    changedAt: new Date(),
  });

  await prisma.followUp.update({
    where: { id },
    data: { dueAt: newDueAt, rescheduleHistory: history as never },
  });

  await writeAudit({
    actorId: actor.id,
    action: "FOLLOWUP_RESCHEDULED",
    targetType: "FollowUp",
    targetId: id,
    summary: `Lead ${followUp.lead.leadCode}: ${followUp.title} -> ${newDueAt.toISOString()}`,
  });
}

export async function cancelFollowUp(actor: SessionUser, id: string): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!followUp) throw new AuthError(404, "Follow-up not found");

  if (actor.role !== "ADMIN") {
    const canAccess = followUp.createdById === actor.id || followUp.assignedToId === actor.id;
    if (!canAccess) throw new AuthError(403, "Forbidden");
  }

  await prisma.followUp.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "FOLLOWUP_CANCELLED",
    targetType: "FollowUp",
    targetId: id,
    summary: `Lead ${followUp.lead.leadCode}: ${followUp.title}`,
  });
}

export async function generateDueReminders(): Promise<{ created: number }> {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueSoon = await prisma.followUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { gte: now, lte: next24h },
    },
    include: {
      lead: true,
      assignedTo: true,
      createdBy: true,
    },
  });

  let created = 0;
  for (const fu of dueSoon) {
    const existing = await prisma.notification.findFirst({
      where: {
        type: "FOLLOWUP_DUE",
        leadId: fu.leadId,
        userId: fu.assignedToId ?? fu.createdById,
        readAt: null,
      },
    });
    if (existing) continue;

    const notifyUserId = fu.assignedToId ?? fu.createdById;
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: "FOLLOWUP_DUE",
        title: `Follow-up due soon: ${fu.title}`,
        body: `Due ${fu.dueAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}`,
        leadId: fu.leadId,
        dedupeKey: `followup-reminder-${fu.id}`,
      },
    });
    created++;
  }

  return { created };
}
