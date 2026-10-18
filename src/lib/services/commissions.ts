import { PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";
import { AuthError, requireRoleOf } from "@/lib/authz";
import { writeAudit } from "@/lib/services/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";
import { z } from "zod";

export const CreateCommissionInputSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  dealAmount: z.number().int().nonnegative("Deal amount must be non-negative"),
  ruleId: z.string().min(1).optional(),
  percentBasisPoints: z.number().int().min(0).max(10000).optional(),
  computedAmount: z.number().int().nonnegative().optional(),
});

export const CreateCommissionRuleInputSchema = z.object({
  name: z.string().trim().min(1, "Rule name is required").max(200),
  percentBasisPoints: z.number().int().min(0).max(10000),
  appliesTo: z.enum(["SALE", "RENT", "LEASE"]).optional().nullable(),
  minAmount: z.number().int().nonnegative().optional().nullable(),
  maxAmount: z.number().int().nonnegative().optional().nullable(),
});

export const CreatePayoutInputSchema = z.object({
  commissionId: z.string().min(1, "Commission ID is required"),
  payeeBrokerId: z.string().min(1, "Payee broker ID is required"),
  shareBasisPoints: z.number().int().min(0).max(10000),
  amount: z.number().int().nonnegative("Amount must be non-negative"),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const UpdatePayoutStatusInputSchema = z.object({
  status: z.nativeEnum(PayoutStatus),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type CreateCommissionInput = z.infer<typeof CreateCommissionInputSchema>;
export type CreateCommissionRuleInput = z.infer<typeof CreateCommissionRuleInputSchema>;
export type CreatePayoutInput = z.infer<typeof CreatePayoutInputSchema>;
export type UpdatePayoutStatusInput = z.infer<typeof UpdatePayoutStatusInputSchema>;

export interface CommissionRow {
  id: string;
  leadId: string;
  dealAmount: number;
  ruleId: string | null;
  percentBasisPoints: number;
  computedAmount: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  payoutCount: number;
  totalPayoutBasisPoints: number;
}

export interface PayoutRow {
  id: string;
  commissionId: string;
  payeeBrokerId: string;
  payeeBrokerName: string | null;
  shareBasisPoints: number;
  amount: number;
  status: PayoutStatus;
  reason: string | null;
  decidedById: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  historyCount: number;
}

export interface CommissionRuleRow {
  id: string;
  name: string;
  percentBasisPoints: number;
  appliesTo: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_TOTAL_SHARE_BPS = 10000;

export function computeCommissionAmount(dealAmount: number, percentBasisPoints: number): number {
  return Math.round((dealAmount * percentBasisPoints) / 10000);
}

export function computePayoutAmount(commissionAmount: number, shareBasisPoints: number): number {
  return Math.round((commissionAmount * shareBasisPoints) / 10000);
}

function commissionScope(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "REFERRAL_BROKER") {
    throw new AuthError(403, "Referral partners cannot access commission information.");
  }
  return {
    lead: {
      OR: [
        { submittedById: actor.id },
        { assignedToId: actor.id },
        { collaborators: { some: { brokerId: actor.id } } },
      ],
    },
  };
}

/**
 * Lead-level access filter for a single lead. `commissionScope` is shaped for
 * the `Commission` model (it filters on the related `lead`), so it must not be
 * used directly against a `Lead` query — doing so produces an invalid Prisma
 * filter. This helper returns a `Lead`-shaped `where` for the same access rule.
 */
function leadAccessWhere(actor: SessionUser, leadId: string): Record<string, unknown> {
  if (actor.role === "ADMIN") return { id: leadId };
  if (actor.role === "REFERRAL_BROKER") {
    throw new AuthError(403, "Referral partners cannot access commission information.");
  }
  return {
    id: leadId,
    OR: [
      { submittedById: actor.id },
      { assignedToId: actor.id },
      { collaborators: { some: { brokerId: actor.id } } },
    ],
  };
}

function payoutScope(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "REFERRAL_BROKER") {
    return { payeeBrokerId: actor.id };
  }
  return {
    OR: [
      { payeeBrokerId: actor.id },
      {
        commission: {
          lead: {
            OR: [
              { submittedById: actor.id },
              { assignedToId: actor.id },
              { collaborators: { some: { brokerId: actor.id } } },
            ],
          },
        },
      },
    ],
  };
}

export async function listCommissionRules(
  actor: SessionUser,
  opts?: { activeOnly?: boolean },
): Promise<CommissionRuleRow[]> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return empty list instead of crashing.
  if (actor.status !== "ACTIVE") return [];
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER"]);

  const where: Record<string, unknown> = {};
  if (opts?.activeOnly) where.active = true;

  const rows = await prisma.commissionRule.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "COMMISSION_RULES_LISTED",
    targetType: "CommissionRule",
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    percentBasisPoints: r.percentBasisPoints,
    appliesTo: r.appliesTo ?? null,
    minAmount: r.minAmount ?? null,
    maxAmount: r.maxAmount ?? null,
    active: r.active,
    createdById: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function createCommissionRule(
  actor: SessionUser,
  input: CreateCommissionRuleInput,
): Promise<CommissionRuleRow> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN"]);

  const parsed = CreateCommissionRuleInputSchema.parse(input);

  if (parsed.minAmount != null && parsed.maxAmount != null && parsed.minAmount > parsed.maxAmount) {
    throw new AuthError(400, "minAmount cannot exceed maxAmount");
  }

  const rule = await prisma.commissionRule.create({
    data: {
      name: parsed.name,
      percentBasisPoints: parsed.percentBasisPoints,
      appliesTo: parsed.appliesTo ?? undefined,
      minAmount: parsed.minAmount ?? undefined,
      maxAmount: parsed.maxAmount ?? undefined,
      active: true,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "COMMISSION_RULE_CREATED",
    targetType: "CommissionRule",
    targetId: rule.id,
    summary: `Created commission rule "${rule.name}" (${rule.percentBasisPoints} bps)`,
  });

  return {
    id: rule.id,
    name: rule.name,
    percentBasisPoints: rule.percentBasisPoints,
    appliesTo: rule.appliesTo ?? null,
    minAmount: rule.minAmount ?? null,
    maxAmount: rule.maxAmount ?? null,
    active: rule.active,
    createdById: rule.createdById,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export async function listCommissions(actor: SessionUser): Promise<CommissionRow[]> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return empty list instead of crashing.
  if (actor.status !== "ACTIVE") return [];

  const scope = commissionScope(actor);

  const rows = await prisma.commission.findMany({
    where: scope as never,
    include: {
      _count: { select: { payouts: true } },
      lead: { select: { id: true, submittedById: true, assignedToId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "COMMISSIONS_LISTED",
    targetType: "Commission",
  });

  return rows.map((c) => ({
    id: c.id,
    leadId: c.leadId,
    dealAmount: c.dealAmount,
    ruleId: c.ruleId ?? null,
    percentBasisPoints: c.percentBasisPoints,
    computedAmount: c.computedAmount,
    createdById: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    payoutCount: c._count.payouts,
    totalPayoutBasisPoints: 0,
  }));
}

export async function getCommission(actor: SessionUser, id: string): Promise<CommissionRow | null> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return null instead of crashing.
  if (actor.status !== "ACTIVE") return null;

  const scope = commissionScope(actor);

  const c = await prisma.commission.findFirst({
    where: { id, ...(scope as Record<string, unknown>) } as never,
    include: {
      _count: { select: { payouts: true } },
      payouts: true,
    },
  });

  if (!c) return null;

  await writeAudit({
    actorId: actor.id,
    action: "COMMISSION_VIEWED",
    targetType: "Commission",
    targetId: c.id,
  });

  return {
    id: c.id,
    leadId: c.leadId,
    dealAmount: c.dealAmount,
    ruleId: c.ruleId ?? null,
    percentBasisPoints: c.percentBasisPoints,
    computedAmount: c.computedAmount,
    createdById: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    payoutCount: c._count.payouts,
    totalPayoutBasisPoints: 0,
  };
}

export async function createCommission(
  actor: SessionUser,
  input: CreateCommissionInput,
): Promise<CommissionRow> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");

  const parsed = CreateCommissionInputSchema.parse(input);

  const lead = await prisma.lead.findFirst({
    where: leadAccessWhere(actor, parsed.leadId) as never,
  });
  if (!lead) {
    throw new AuthError(404, "Lead not found or you do not have access to it.");
  }

  const existing = await prisma.commission.findUnique({ where: { leadId: parsed.leadId } });
  if (existing) {
    throw new AuthError(409, "A commission already exists for this lead.");
  }

  let percentBasisPoints = parsed.percentBasisPoints ?? 0;

  if (parsed.ruleId) {
    const rule = await prisma.commissionRule.findUnique({ where: { id: parsed.ruleId } });
    if (!rule) throw new AuthError(404, "Commission rule not found.");
    if (!rule.active) throw new AuthError(400, "Commission rule is not active.");
    if (rule.minAmount !== null && parsed.dealAmount < rule.minAmount) {
      throw new AuthError(400, `Deal amount is below the rule minimum (${rule.minAmount}).`);
    }
    if (rule.maxAmount !== null && parsed.dealAmount > rule.maxAmount) {
      throw new AuthError(400, `Deal amount exceeds the rule maximum (${rule.maxAmount}).`);
    }
    percentBasisPoints = rule.percentBasisPoints;
  }

  const computedAmount = parsed.computedAmount ?? computeCommissionAmount(parsed.dealAmount, percentBasisPoints);

  const commission = await prisma.commission.create({
    data: {
      leadId: parsed.leadId,
      dealAmount: parsed.dealAmount,
      ruleId: parsed.ruleId ?? null,
      percentBasisPoints,
      computedAmount,
      createdById: actor.id,
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "COMMISSION_CREATED",
    targetType: "Commission",
    targetId: commission.id,
    summary: `Commission for lead ${parsed.leadId}: ${parsed.dealAmount} @ ${percentBasisPoints}bps = ${computedAmount}`,
  });

  return {
    id: commission.id,
    leadId: commission.leadId,
    dealAmount: commission.dealAmount,
    ruleId: commission.ruleId ?? null,
    percentBasisPoints: commission.percentBasisPoints,
    computedAmount: commission.computedAmount,
    createdById: commission.createdById,
    createdAt: commission.createdAt,
    updatedAt: commission.updatedAt,
    payoutCount: 0,
    totalPayoutBasisPoints: 0,
  };
}

export async function listPayouts(actor: SessionUser): Promise<PayoutRow[]> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return empty list instead of crashing.
  if (actor.status !== "ACTIVE") return [];

  const scope = payoutScope(actor);

  const rows = await prisma.payout.findMany({
    where: scope as never,
    include: {
      _count: { select: { history: true } },
      payeeBroker: { select: { id: true, email: true } },
      commission: { select: { id: true, leadId: true, computedAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  await writeAudit({
    actorId: actor.id,
    action: "PAYOUTS_LISTED",
    targetType: "Payout",
  });

  return rows.map((p) => ({
    id: p.id,
    commissionId: p.commissionId,
    payeeBrokerId: p.payeeBrokerId,
    payeeBrokerName: p.payeeBroker.email ?? null,
    shareBasisPoints: p.shareBasisPoints,
    amount: p.amount,
    status: p.status,
    reason: p.reason ?? null,
    decidedById: p.decidedById ?? null,
    decidedAt: p.decidedAt ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    historyCount: p._count.history,
  }));
}

export async function getPayout(actor: SessionUser, id: string): Promise<PayoutRow | null> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return null instead of crashing.
  if (actor.status !== "ACTIVE") return null;

  const scope = payoutScope(actor);

  const p = await prisma.payout.findFirst({
    where: { id, ...(scope as Record<string, unknown>) } as never,
    include: {
      _count: { select: { history: true } },
      payeeBroker: { select: { id: true, email: true } },
      commission: { select: { id: true, leadId: true, computedAmount: true } },
    },
  });

  if (!p) return null;

  await writeAudit({
    actorId: actor.id,
    action: "PAYOUT_VIEWED",
    targetType: "Payout",
    targetId: p.id,
  });

  return {
    id: p.id,
    commissionId: p.commissionId,
    payeeBrokerId: p.payeeBrokerId,
    payeeBrokerName: p.payeeBroker.email ?? null,
    shareBasisPoints: p.shareBasisPoints,
    amount: p.amount,
    status: p.status,
    reason: p.reason ?? null,
    decidedById: p.decidedById ?? null,
    decidedAt: p.decidedAt ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    historyCount: p._count.history,
  };
}


export async function createPayout(
  actor: SessionUser,
  input: CreatePayoutInput,
): Promise<PayoutRow> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  const commissionScope_ = commissionScope(actor);

  const parsed = CreatePayoutInputSchema.parse(input);

  const commission = await prisma.commission.findFirst({
    where: { id: parsed.commissionId, ...(commissionScope_ as Record<string, unknown>) } as never,
  });
  if (!commission) {
    throw new AuthError(404, "Commission not found or you do not have access to it.");
  }

  const payee = await prisma.user.findUnique({ where: { id: parsed.payeeBrokerId } });
  if (!payee) {
    throw new AuthError(404, "Payee broker not found.");
  }

  const existingPayouts = await prisma.payout.findMany({
    where: { commissionId: parsed.commissionId },
    select: { shareBasisPoints: true },
  });
  const totalExistingBps = existingPayouts.reduce((sum, p) => sum + p.shareBasisPoints, 0);
  if (totalExistingBps + parsed.shareBasisPoints > MAX_TOTAL_SHARE_BPS) {
    throw new AuthError(
      400,
      `Total share (${totalExistingBps + parsed.shareBasisPoints}bps) exceeds 10000bps (100%).`,
    );
  }

  const payout = await prisma.$transaction(async (tx) => {
    const created = await tx.payout.create({
      data: {
        commissionId: parsed.commissionId,
        payeeBrokerId: parsed.payeeBrokerId,
        shareBasisPoints: parsed.shareBasisPoints,
        amount: parsed.amount,
        status: PayoutStatus.PENDING,
        reason: parsed.reason ?? null,
      },
    });
    await tx.payoutHistory.create({
      data: {
        payoutId: created.id,
        fromStatus: null,
        toStatus: PayoutStatus.PENDING,
        changedById: actor.id,
        reason: parsed.reason ?? null,
      },
    });
    return created;
  });

  await writeAudit({
    actorId: actor.id,
    action: "PAYOUT_CREATED",
    targetType: "Payout",
    targetId: payout.id,
    summary: `Payout of ${payout.amount} (${payout.shareBasisPoints}bps) to broker ${parsed.payeeBrokerId} for commission ${parsed.commissionId}`,
  });

  return {
    id: payout.id,
    commissionId: payout.commissionId,
    payeeBrokerId: payout.payeeBrokerId,
    payeeBrokerName: payee.email ?? null,
    shareBasisPoints: payout.shareBasisPoints,
    amount: payout.amount,
    status: payout.status,
    reason: payout.reason ?? null,
    decidedById: payout.decidedById ?? null,
    decidedAt: payout.decidedAt ?? null,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
    historyCount: 1,
  };
}

export async function updatePayoutStatus(
  actor: SessionUser,
  payoutId: string,
  input: UpdatePayoutStatusInput,
): Promise<PayoutRow> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  const payoutScope_ = payoutScope(actor);

  const parsed = UpdatePayoutStatusInputSchema.parse(input);

  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, ...(payoutScope_ as Record<string, unknown>) } as never,
    include: { commission: true },
  });
  if (!payout) {
    throw new AuthError(404, "Payout not found or you do not have access to it.");
  }

  if (parsed.status === PayoutStatus.PAID || parsed.status === PayoutStatus.CANCELLED) {
    requireRoleOf(actor, ["ADMIN"]);
  } else if (parsed.status === PayoutStatus.APPROVED) {
    if (actor.role !== "ADMIN") {
      const hasCommissionAccess = await prisma.commission.findFirst({
        where: {
          id: payout.commissionId,
          ...(commissionScope(actor) as Record<string, unknown>),
        } as never,
      });
      if (!hasCommissionAccess) {
        throw new AuthError(403, "You cannot approve this payout.");
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: parsed.status,
        reason: parsed.reason ?? payout.reason ?? null,
        ...(parsed.status === PayoutStatus.PAID || parsed.status === PayoutStatus.CANCELLED
          ? { decidedById: actor.id, decidedAt: new Date() }
          : {}),
      },
    });
    await tx.payoutHistory.create({
      data: {
        payoutId,
        fromStatus: payout.status,
        toStatus: parsed.status,
        changedById: actor.id,
        reason: parsed.reason ?? null,
      },
    });
    return current;
  });

  await writeAudit({
    actorId: actor.id,
    action: "PAYOUT_STATUS_CHANGED",
    targetType: "Payout",
    targetId: payoutId,
    summary: `Payout ${payoutId}: ${payout.status} -> ${parsed.status}`,
  });

  return {
    id: updated.id,
    commissionId: updated.commissionId,
    payeeBrokerId: updated.payeeBrokerId,
    payeeBrokerName: null,
    shareBasisPoints: updated.shareBasisPoints,
    amount: updated.amount,
    status: updated.status,
    reason: updated.reason ?? null,
    decidedById: updated.decidedById ?? null,
    decidedAt: updated.decidedAt ?? null,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    historyCount: 0,
  };
}


export async function listCommissionsAction(
  actor: SessionUser,
): Promise<ActionResult<CommissionRow[]>> {
  try {
    const data = await listCommissions(actor);
    return actionSuccess(data);
  } catch (err) {
    if (err instanceof AuthError) return actionError(err.message);
    return actionError("Failed to list commissions.");
  }
}

export async function createCommissionAction(
  actor: SessionUser,
  input: CreateCommissionInput,
): Promise<ActionResult<CommissionRow>> {
  try {
    const data = await createCommission(actor, input);
    return actionSuccess(data);
  } catch (err) {
    if (err instanceof AuthError) return actionError(err.message);
    if (err instanceof z.ZodError) {
      return actionError("Invalid commission input.", err.flatten().fieldErrors as Record<string, string[]>);
    }
    return actionError("Failed to create commission.");
  }
}

export async function createPayoutAction(
  actor: SessionUser,
  input: CreatePayoutInput,
): Promise<ActionResult<PayoutRow>> {
  try {
    const data = await createPayout(actor, input);
    return actionSuccess(data);
  } catch (err) {
    if (err instanceof AuthError) return actionError(err.message);
    if (err instanceof z.ZodError) {
      return actionError("Invalid payout input.", err.flatten().fieldErrors as Record<string, string[]>);
    }
    return actionError("Failed to create payout.");
  }
}

export async function updatePayoutStatusAction(
  actor: SessionUser,
  payoutId: string,
  input: UpdatePayoutStatusInput,
): Promise<ActionResult<PayoutRow>> {
  try {
    const data = await updatePayoutStatus(actor, payoutId, input);
    return actionSuccess(data);
  } catch (err) {
    if (err instanceof AuthError) return actionError(err.message);
    if (err instanceof z.ZodError) {
      return actionError("Invalid status update.", err.flatten().fieldErrors as Record<string, string[]>);
    }
    return actionError("Failed to update payout status.");
  }
}

