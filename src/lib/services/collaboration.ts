import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";
import { writeAudit } from "@/lib/services/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/validation/common";
import { z } from "zod";

export const AddCollaboratorInputSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  brokerId: z.string().min(1, "Broker ID is required"),
  role: z.string().trim().min(1).max(40).default("CO_BROKER"),
});

export type AddCollaboratorInput = z.infer<typeof AddCollaboratorInputSchema>;

export interface CollaboratorRow {
  id: string;
  leadId: string;
  brokerId: string;
  brokerName: string | null;
  brokerRole: string;
  role: string;
  addedById: string;
  createdAt: Date;
}

async function canManageLead(actor: SessionUser, leadId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { submittedById: true, assignedToId: true },
  });
  if (!lead) return false;
  return lead.submittedById === actor.id || lead.assignedToId === actor.id;
}

/**
 * Add a co-broker collaborator to a lead. Only the lead submitter, the
 * assignee, or an admin can add collaborators. The target must be an active
 * MAIN_BROKER or REFERRAL_BROKER and must not already be the owner/assignee
 * or an existing collaborator of the lead.
 */
export async function addCollaborator(
  actor: SessionUser,
  raw: unknown,
): Promise<ActionResult<{ collaboratorId: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const parsed = AddCollaboratorInputSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  }
  const { leadId, brokerId, role } = parsed.data;

  if (!(await canManageLead(actor, leadId))) {
    return actionError("You can only manage collaborators on leads you own or that are assigned to you.");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return actionError("Lead not found.");
  if (lead.submittedById === brokerId || lead.assignedToId === brokerId) {
    return actionError("This broker already owns or is assigned to this lead.");
  }

  const target = await prisma.user.findUnique({ where: { id: brokerId } });
  if (!target || target.status !== "ACTIVE") return actionError("Target broker is not active.");
  if (target.role !== "MAIN_BROKER" && target.role !== "REFERRAL_BROKER") {
    return actionError("Collaborators must be brokers (MAIN_BROKER or REFERRAL_BROKER).");
  }

  const existing = await prisma.dealCollaborator.findUnique({
    where: { leadId_brokerId: { leadId, brokerId } },
  });
  if (existing) return actionError("This broker is already a collaborator on this lead.");

  const collab = await prisma.$transaction(async (tx) => {
    const created = await tx.dealCollaborator.create({
      data: { leadId, brokerId, role, addedById: actor.id },
    });
    await tx.notification.create({
      data: {
        userId: brokerId,
        title: "Added as collaborator",
        body: `You were added as a collaborator on lead ${lead.leadCode}.`,
        type: "ASSIGNMENT",
        leadId,
      },
    });
    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "COLLABORATOR_ADDED",
    targetType: "DealCollaborator",
    targetId: collab.id,
    summary: `Broker ${brokerId} added as collaborator on lead ${lead.leadCode}`,
  });

  return actionSuccess({ collaboratorId: collab.id });
}

/**
 * Remove a co-broker collaborator from a lead. Only the lead submitter, the
 * assignee, or an admin can remove collaborators.
 */
export async function removeCollaborator(
  actor: SessionUser,
  leadId: string,
  brokerId: string,
): Promise<ActionResult<undefined>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  if (!(await canManageLead(actor, leadId))) {
    return actionError("You can only manage collaborators on leads you own or that are assigned to you.");
  }

  const existing = await prisma.dealCollaborator.findUnique({
    where: { leadId_brokerId: { leadId, brokerId } },
  });
  if (!existing) return actionError("Collaborator not found on this lead.");

  await prisma.dealCollaborator.delete({
    where: { leadId_brokerId: { leadId, brokerId } },
  });

  await writeAudit({
    actorId: actor.id,
    action: "COLLABORATOR_REMOVED",
    targetType: "DealCollaborator",
    targetId: existing.id,
    summary: `Broker ${brokerId} removed as collaborator on lead ${leadId}`,
  });

  return actionSuccess(undefined);
}

/**
 * List collaborators on a lead. Visible to the lead submitter, assignee,
 * admins, and the collaborators themselves.
 */
export async function listCollaborators(actor: SessionUser, leadId: string): Promise<CollaboratorRow[]> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  if (!(await canManageLead(actor, leadId))) {
    const own = await prisma.dealCollaborator.findUnique({
      where: { leadId_brokerId: { leadId, brokerId: actor.id } },
    });
    if (!own) throw new AuthError(403, "You cannot view collaborators on this lead.");
  }

  const rows = await prisma.dealCollaborator.findMany({
    where: { leadId },
    include: {
      broker: { include: { brokerProfile: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((c) => ({
    id: c.id,
    leadId: c.leadId,
    brokerId: c.brokerId,
    brokerName: c.broker.brokerProfile?.fullName ?? c.broker.email ?? null,
    brokerRole: c.broker.role,
    role: c.role,
    addedById: c.addedById,
    createdAt: c.createdAt,
  }));
}
