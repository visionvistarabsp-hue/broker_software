import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";
import { writeAudit } from "@/lib/services/audit";

export interface SiteVisitRow {
  id: string;
  leadId: string;
  propertyId: string | null;
  scheduledAt: Date;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | string;
  notes: string | null;
  lead?: { id: string; leadCode: string; customer: { fullName: string } | null } | null;
  property?: { id: string; title: string } | null;
  createdById: string;
}

function scopeSiteVisitWhere(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  // SiteVisit has no assignedToId column; scope through the related Lead,
  // matching the access rule used by scheduleVisit.
  return {
    OR: [
      { createdById: actor.id },
      { lead: { submittedById: actor.id } },
      { lead: { assignedToId: actor.id } },
    ],
  };
}

export async function listSiteVisits(
  actor: SessionUser,
  opts?: { from?: Date; to?: Date },
): Promise<SiteVisitRow[]> {
  // Non-ACTIVE (e.g. PENDING) users may browse; return empty rather than crash.
  if (actor.status !== "ACTIVE") return [];
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const where: Record<string, unknown> = { ...scopeSiteVisitWhere(actor) };
  if (opts?.from || opts?.to) {
    const dateFilter: Record<string, unknown> = {};
    if (opts.from) dateFilter.gte = opts.from;
    if (opts.to) dateFilter.lte = opts.to;
    where.scheduledAt = dateFilter as never;
  }

  const rows = await prisma.siteVisit.findMany({
    where: where as never,
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: {
        include: {
          customer: { select: { fullName: true } },
        },
      },
      property: true,
    },
  });

  return rows.map((sv) => ({
    id: sv.id,
    leadId: sv.leadId,
    propertyId: sv.propertyId,
    scheduledAt: sv.scheduledAt,
    status: sv.status,
    notes: sv.notes,
    createdById: sv.createdById,
    lead: sv.lead
      ? {
          id: sv.lead.id,
          leadCode: sv.lead.leadCode,
          customer: sv.lead.customer ? { fullName: sv.lead.customer.fullName } : null,
        }
      : null,
    property: sv.property ? { id: sv.property.id, title: sv.property.title } : null,
  }));
}



export async function scheduleVisit(
  actor: SessionUser,
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (actor.status !== "ACTIVE") return { ok: false, error: "Account is not active." };
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const raw = input as {
    leadId?: string;
    propertyId?: string;
    scheduledAt?: string | Date;
    notes?: string;
  };

  const leadId = raw.leadId?.trim();
  const propertyId = raw.propertyId?.trim() || null;
  const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt) : null;
  const notes = raw.notes?.trim() || null;

  if (!leadId) return { ok: false, error: "Lead is required." };
  if (!scheduledAt) return { ok: false, error: "Scheduled date is required." };

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found." };

  if (actor.role !== "ADMIN") {
    const canAccess = lead.submittedById === actor.id || lead.assignedToId === actor.id;
    if (!canAccess) return { ok: false, error: "Forbidden: you do not have access to this lead." };
  }

  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return { ok: false, error: "Property not found." };
  }

  const notifyUserId = lead.submittedById;
  const visit = await prisma.siteVisit.create({
    data: {
      leadId,
      propertyId,
      scheduledAt,
      notes,
      createdById: actor.id,
    },
  });

  if (notifyUserId && notifyUserId !== actor.id) {
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: "ASSIGNMENT",
        title: `New site visit scheduled`,
        body: `Lead ${lead.leadCode} — ${scheduledAt.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}`,
        leadId,
        dedupeKey: `sitevisit-schedule-${visit.id}`,
      },
    });
  }

  await writeAudit({
    actorId: actor.id,
    action: "SITE_VISIT_SCHEDULED",
    targetType: "SiteVisit",
    targetId: visit.id,
    summary: `Lead ${lead.leadCode}: site visit`,
  });

  return { ok: true };
}

export async function completeVisit(actor: SessionUser, id: string): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const visit = await prisma.siteVisit.findUnique({ where: { id }, include: { lead: true } });
  if (!visit) throw new AuthError(404, "Site visit not found");

  if (actor.role !== "ADMIN") {
    const canAccess = visit.createdById === actor.id || visit.lead.assignedToId === actor.id;
    if (!canAccess) throw new AuthError(403, "Forbidden");
  }

  await prisma.siteVisit.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "SITE_VISIT_COMPLETED",
    targetType: "SiteVisit",
    targetId: id,
    summary: `Lead ${visit.lead.leadCode}`,
  });
}

export async function cancelVisit(actor: SessionUser, id: string): Promise<void> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const visit = await prisma.siteVisit.findUnique({ where: { id }, include: { lead: true } });
  if (!visit) throw new AuthError(404, "Site visit not found");

  if (actor.role !== "ADMIN") {
    const canAccess = visit.createdById === actor.id || visit.lead.assignedToId === actor.id;
    if (!canAccess) throw new AuthError(403, "Forbidden");
  }

  await prisma.siteVisit.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "SITE_VISIT_CANCELLED",
    targetType: "SiteVisit",
    targetId: id,
    summary: `Lead ${visit.lead.leadCode}`,
  });
}
