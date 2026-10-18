import { prisma } from "@/lib/db";
import { AuthError, requireRoleOf, type SessionUser } from "@/lib/authz";

export interface ReputationMetrics {
  totalLeads: number;
  convertedLeads: number;
  totalFollowUps: number;
  completedFollowUps: number;
  totalSiteVisits: number;
  completedSiteVisits: number;
  paidPayoutAmount: number;
}

export interface ReputationScore {
  score: number;
  breakdown: {
    conversion: number;
    followUps: number;
    siteVisits: number;
    volume: number;
    payouts: number;
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Deterministic broker reputation score (0-100). Weighted across conversion
 * rate, follow-up completion, site-visit completion, lead volume (capped),
 * and paid payout amount (capped). No AI — plain arithmetic so it is auditable
 * and unit-testable.
 */
export function computeReputationScore(m: ReputationMetrics): ReputationScore {
  const conversionRate = m.totalLeads > 0 ? clamp01(m.convertedLeads / m.totalLeads) : 0;
  const followUpRate = m.totalFollowUps > 0 ? clamp01(m.completedFollowUps / m.totalFollowUps) : 0;
  const siteVisitRate = m.totalSiteVisits > 0 ? clamp01(m.completedSiteVisits / m.totalSiteVisits) : 0;
  // Volume saturates at 50 leads; payouts saturate at 1,000,000 (currency units).
  const volumeScore = clamp01(m.totalLeads / 50);
  const payoutScore = clamp01(m.paidPayoutAmount / 1_000_000);

  const breakdown = {
    conversion: Math.round(conversionRate * 35),
    followUps: Math.round(followUpRate * 15),
    siteVisits: Math.round(siteVisitRate * 15),
    volume: Math.round(volumeScore * 15),
    payouts: Math.round(payoutScore * 20),
  };
  const score = breakdown.conversion + breakdown.followUps + breakdown.siteVisits + breakdown.volume + breakdown.payouts;
  return { score, breakdown };
}

export async function getReputation(actor: SessionUser, brokerId?: string): Promise<ReputationScore & { brokerId: string }> {
  // Non-ACTIVE (e.g. PENDING) users may browse — return zeroed score instead of crashing.
  if (actor.status !== "ACTIVE") {
    return {
      brokerId: brokerId ?? actor.id,
      score: 0,
      breakdown: { conversion: 0, followUps: 0, siteVisits: 0, volume: 0, payouts: 0 },
    };
  }
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const targetId = brokerId ?? actor.id;
  if (targetId !== actor.id && actor.role !== "ADMIN") {
    throw new AuthError(403, "You can only view your own reputation.");
  }

  const [totalLeads, convertedLeads, totalFollowUps, completedFollowUps, totalSiteVisits, completedSiteVisits, paidPayouts] =
    await Promise.all([
      prisma.lead.count({ where: { submittedById: targetId } }),
      prisma.lead.count({ where: { submittedById: targetId, status: "CONVERTED" } }),
      prisma.followUp.count({ where: { assignedToId: targetId } }),
      prisma.followUp.count({ where: { assignedToId: targetId, status: "COMPLETED" } }),
      prisma.siteVisit.count({ where: { createdById: targetId } }),
      prisma.siteVisit.count({ where: { createdById: targetId, status: "COMPLETED" } }),
      prisma.payout.aggregate({ where: { payeeBrokerId: targetId, status: "PAID" }, _sum: { amount: true } }),
    ]);

  const { score, breakdown } = computeReputationScore({
    totalLeads,
    convertedLeads,
    totalFollowUps,
    completedFollowUps,
    totalSiteVisits,
    completedSiteVisits,
    paidPayoutAmount: paidPayouts._sum.amount ?? 0,
  });

  return { brokerId: targetId, score, breakdown };
}
