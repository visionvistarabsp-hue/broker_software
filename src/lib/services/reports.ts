import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/authz";

export interface DashboardStats {
  leadsTotal: number;
  leadsNew: number;
  leadsConverted: number;
  leadsLost: number;
  conversionRate: number;
  customersTotal: number;
  propertiesActive: number;
  propertiesTotal: number;
  duplicatesPending: number;
  leadsByStatus: { status: string; count: number }[];
}

export async function getDashboardStats(actor: SessionUser): Promise<DashboardStats> {
  const leadScope = actor.role === "ADMIN" ? {} : { OR: [{ submittedById: actor.id }, { assignedToId: actor.id }] };
  const customerScope =
    actor.role === "ADMIN" ? {} : { OR: [{ createdById: actor.id }, { ownerBrokerId: actor.id }] };

  const [leadsTotal, leadsNew, leadsConverted, leadsLost, customersTotal, propertiesActive, propertiesTotal, duplicatesPending, byStatus] =
    await Promise.all([
      prisma.lead.count({ where: leadScope }),
      prisma.lead.count({ where: { ...leadScope, status: "NEW" } }),
      prisma.lead.count({ where: { ...leadScope, status: "CONVERTED" } }),
      prisma.lead.count({ where: { ...leadScope, status: "LOST" } }),
      prisma.customer.count({ where: customerScope }),
      prisma.property.count({ where: { status: "ACTIVE" } }),
      prisma.property.count(),
      actor.role === "ADMIN" ? prisma.duplicateReview.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      prisma.lead.groupBy({ by: ["status"], where: leadScope, _count: { status: true } }),
    ]);

  const conversionRate = leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 1000) / 10 : 0;

  return {
    leadsTotal, leadsNew, leadsConverted, leadsLost, conversionRate,
    customersTotal, propertiesActive, propertiesTotal, duplicatesPending,
    leadsByStatus: byStatus.map((b) => ({ status: b.status, count: b._count.status })),
  };
}
