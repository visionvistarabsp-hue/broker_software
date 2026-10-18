import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";
import { generateUniqueCode } from "@/lib/services/codes";
import { leadCreateSchema, isValidLeadTransition, type LeadCreateInput } from "@/lib/validation/crm";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/validation/common";
import { writeAudit } from "@/lib/services/audit";
import type { LeadStatus } from "@prisma/client";

export async function listLeads(actor: SessionUser, opts?: { q?: string; status?: string; page?: number; pageSize?: number }) {
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
  // PENDING (not yet approved) brokers have no lead activity to show; return an
  // empty page instead of throwing so the app shell does not crash on load.
  if (actor.status !== "ACTIVE") return { total: 0, page, pageSize, rows: [] };
  const q = (opts?.q ?? "").trim();
  const scope = actor.role === "ADMIN" ? {} : { OR: [{ submittedById: actor.id }, { assignedToId: actor.id }, { collaborators: { some: { brokerId: actor.id } } }] };
  const where: Record<string, unknown> = { ...scope };
  if (opts?.status) where.status = opts.status as LeadStatus;
  if (q) {
    where.AND = [{ OR: [{ leadCode: { contains: q } }, { customer: { fullName: { contains: q, mode: "insensitive" } } }] }];
  }
  const [total, rows] = await Promise.all([
    prisma.lead.count({ where: where as never }),
    prisma.lead.findMany({
      where: where as never, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { customer: true, property: { select: { id: true, title: true, propertyCode: true, price: true } }, submittedBy: { include: { brokerProfile: true } }, duplicateReview: true },
    }),
  ]);
  return { total, page, pageSize, rows };
}

export async function submitLead(actor: SessionUser, raw: unknown): Promise<ActionResult<{ leadId: string; leadCode: string; duplicateReview: boolean }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["MAIN_BROKER", "REFERRAL_BROKER", "ADMIN"]);
  const parsed = leadCreateSchema.safeParse(raw);
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  const input: LeadCreateInput = parsed.data;
  if (input.propertyId) {
    const prop = await prisma.property.findUnique({ where: { id: input.propertyId } });
    if (!prop) return actionError("Selected property was not found.");
    if (prop.status !== "ACTIVE") return actionError("Only ACTIVE properties can be attached to a new lead.");
  }
  let assignedToId: string | null = null;
  if (input.assignedToId) {
    if (actor.role !== "ADMIN") return actionError("Only admins can assign leads.");
    const target = await prisma.user.findUnique({ where: { id: input.assignedToId } });
    if (!target || target.status !== "ACTIVE") return actionError("Assignee is not an active broker.");
    assignedToId = target.id;
  }
  const leadCode = await generateUniqueCode(async (c) => !!(await prisma.lead.findUnique({ where: { leadCode: c } })));
  const result = await prisma.$transaction(async (tx) => {
    // Serialize submissions for the same normalized phone so concurrent
    // requests cannot both create a customer or miss the duplicate review.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.customerPhone}))`;
    const existingCustomer = await tx.customer.findFirst({ where: { phoneNormalized: input.customerPhone }, orderBy: { createdAt: "asc" } });
    let customerId: string;
    let duplicate = false;
    let candidateId: string | null = null;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      duplicate = true;
      candidateId = existingCustomer.id;
    } else {
      const customerCode = await generateUniqueCode(async (c) => !!(await tx.customer.findUnique({ where: { customerCode: c } })));
      const createdCustomer = await tx.customer.create({
        data: {
          customerCode, fullName: input.customerName.trim(), phoneOriginal: input.customerPhone,
          phoneNormalized: input.customerPhone, email: input.customerEmail?.trim() || null,
          address: input.customerAddress?.trim() || null, city: input.customerCity?.trim() || null,
          ownerBrokerId: actor.role === "MAIN_BROKER" ? actor.id : null, createdById: actor.id, consentAt: new Date(),
        },
      });
      customerId = createdCustomer.id;
    }
    const lead = await tx.lead.create({
      data: {
        leadCode, customerId, submittedById: actor.id, source: input.source || "REFERRAL",
        propertyId: input.propertyId || null, budgetMin: input.budgetMin ?? null, budgetMax: input.budgetMax ?? null,
        preferredLocation: input.preferredLocation?.trim() || null, requirements: input.requirements?.trim() || null,
        notes: input.notes?.trim() || null, priority: input.priority, assignedToId, status: "NEW",
      },
    });
    await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: null, toStatus: "NEW", changedById: actor.id, reason: "Lead submitted" } });
    if (duplicate && candidateId) {
      await tx.duplicateReview.create({ data: { leadId: lead.id, candidateCustomerId: candidateId, status: "PENDING" } });
    }
    return { leadId: lead.id, leadCode: lead.leadCode, duplicateReview: duplicate };
  });
  await writeAudit({ actorId: actor.id, action: result.duplicateReview ? "LEAD_SUBMITTED_DUPLICATE" : "LEAD_SUBMITTED", targetType: "Lead", targetId: result.leadId, summary: `Lead ${result.leadCode} submitted${result.duplicateReview ? " (duplicate review)" : ""}` });
  return actionSuccess(result);
}

export async function getLead(actor: SessionUser, id: string) {
  // READ: no status gate here — ownership checks below still apply, so a
  // PENDING broker can only open leads they submitted/are assigned/collaborate on.
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: true, property: true, submittedBy: { include: { brokerProfile: true } },
      assignedTo: { include: { brokerProfile: true } }, duplicateReview: { include: { candidateCustomer: true } },
      history: { orderBy: { createdAt: "desc" }, include: { changedBy: { include: { brokerProfile: true } } } },
    },
  });
  if (!lead) throw new AuthError(404, "Lead not found");
  if (actor.role !== "ADMIN" && lead.submittedById !== actor.id && lead.assignedToId !== actor.id) {
    const collab = await prisma.dealCollaborator.findUnique({
      where: { leadId_brokerId: { leadId: id, brokerId: actor.id } },
    });
    if (!collab) throw new AuthError(403, "Forbidden");
  }
  return lead;
}

export async function changeLeadStatus(actor: SessionUser, leadId: string, toStatus: LeadStatus, reason?: string, lostReason?: string): Promise<ActionResult<{ status: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return actionError("Lead not found.");
  if (actor.role !== "ADMIN" && lead.submittedById !== actor.id && lead.assignedToId !== actor.id) {
    return actionError("You do not have access to this lead.");
  }
  if (!isValidLeadTransition(lead.status, toStatus)) {
    return actionError(`Transition from ${lead.status} to ${toStatus} is not allowed.`);
  }
  if (toStatus === "LOST" && !((lostReason ?? reason)?.trim())) {
    return actionError("A loss reason is required to mark a lead as LOST.");
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status: toStatus,
        convertedAt: toStatus === "CONVERTED" ? now : lead.convertedAt,
        lostAt: toStatus === "LOST" ? now : toStatus === "CONVERTED" ? null : lead.lostAt,
        lostReason: toStatus === "LOST" ? ((lostReason ?? reason)?.trim() || null) : toStatus === "CONVERTED" ? null : lead.lostReason,
      },
    });
    await tx.leadStatusHistory.create({
      data: { leadId, fromStatus: lead.status, toStatus, changedById: actor.id, reason: reason?.trim() || lostReason?.trim() || null },
    });
  });
  await writeAudit({ actorId: actor.id, action: "LEAD_STATUS_CHANGED", targetType: "Lead", targetId: leadId, summary: `${lead.leadCode}: ${lead.status} -> ${toStatus}` });
  return actionSuccess({ status: toStatus });
}

export async function resolveDuplicate(
  actor: SessionUser, leadId: string, decision: "LINKED" | "DISTINCT_APPROVED" | "REJECTED", reason?: string
): Promise<ActionResult<{ status: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  if (actor.role !== "ADMIN") return actionError("Only admins can resolve duplicates.");
  if (!reason?.trim() && decision !== "LINKED") return actionError("A decision reason is required.");
  const review = await prisma.duplicateReview.findUnique({ where: { leadId }, include: { lead: true } });
  if (!review) return actionError("No duplicate review found for this lead.");
  if (review.status !== "PENDING") return actionError("This duplicate review is already decided.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (decision === "DISTINCT_APPROVED") {
      const src = await tx.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
      if (src) {
        const customerCode = await generateUniqueCode(async (c) => !!(await tx.customer.findUnique({ where: { customerCode: c } })));
        const distinct = await tx.customer.create({
          data: {
            customerCode, fullName: src.customer.fullName, phoneOriginal: `${src.customer.phoneOriginal} (shared)`,
            phoneNormalized: `${src.customer.phoneNormalized}#${leadId.slice(-6)}`,
            email: src.customer.email, address: src.customer.address, city: src.customer.city,
            createdById: src.submittedById, consentAt: new Date(),
          },
        });
        await tx.lead.update({ where: { id: leadId }, data: { customerId: distinct.id } });
      }
    }
    if (decision === "REJECTED") {
      await tx.lead.update({ where: { id: leadId }, data: { status: "LOST", lostAt: now, lostReason: reason?.trim() || "Duplicate rejected" } });
      await tx.leadStatusHistory.create({ data: { leadId, fromStatus: review.lead.status, toStatus: "LOST", changedById: actor.id, reason: reason?.trim() || "Duplicate rejected" } });
    }
    await tx.duplicateReview.update({ where: { leadId }, data: { status: decision, decidedById: actor.id, reason: reason?.trim() || null, decidedAt: now } });
  });
  await writeAudit({ actorId: actor.id, action: "DUPLICATE_RESOLVED", targetType: "DuplicateReview", targetId: leadId, summary: `Duplicate for lead ${leadId} -> ${decision}` });
  return actionSuccess({ status: decision });
}

export async function duplicateQueue(actor: SessionUser) {
  if (actor.role !== "ADMIN") throw new AuthError(403, "Forbidden");
  return prisma.duplicateReview.findMany({
    where: { status: "PENDING" }, orderBy: { createdAt: "asc" },
    include: { lead: { include: { customer: true, submittedBy: { include: { brokerProfile: true } } } }, candidateCustomer: true },
  });
}
