import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/services/phone";
import { generateUniqueCode } from "@/lib/services/codes";
import { writeAudit } from "@/lib/services/audit";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/validation/common";
import { z } from "zod";

export const PublicReferralInputSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required").max(120),
  customerPhone: z.string().trim().min(1, "Phone is required"),
  customerEmail: z
    .union([z.string().trim().email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  city: z.string().trim().max(120).optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
  message: z.string().trim().max(2000).optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
});

export type PublicReferralInput = z.infer<typeof PublicReferralInputSchema>;

export interface PublicBrokerProfile {
  brokerCode: string;
  fullName: string;
  city: string | null;
  company: string | null;
}

/** Hours within which the same phone cannot re-submit a referral for the same broker. */
const REFERRAL_SPAM_WINDOW_HOURS = 24;

/**
 * Public broker profile for the share page. Deliberately exposes only
 * name/city/company/brokerCode — never phone, email, or any lead/customer data.
 */
export async function getPublicBrokerProfile(brokerCode: string): Promise<PublicBrokerProfile | null> {
  const trimmed = (brokerCode ?? "").trim();
  if (!trimmed) return null;

  const profile = await prisma.brokerProfile.findUnique({
    where: { brokerCode: trimmed },
    include: { user: { select: { role: true, status: true } } },
  });
  if (!profile) return null;
  if (profile.user.status !== "ACTIVE") return null;
  if (profile.user.role !== "MAIN_BROKER" && profile.user.role !== "REFERRAL_BROKER") return null;

  return {
    brokerCode: profile.brokerCode,
    fullName: profile.fullName,
    city: profile.city ?? null,
    company: profile.company ?? null,
  };
}

/**
 * Public referral submission via a broker's share link. Creates a lead
 * attributed to the broker (submittedById = broker). Spam-guarded per phone
 * per broker within a 24h window. Returns a lead code as the public reference.
 */
export async function submitReferral(brokerCode: string, raw: unknown): Promise<ActionResult<{ reference: string }>> {
  const parsed = PublicReferralInputSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;

  const normalizedPhone = normalizePhone(input.customerPhone);
  if (!normalizedPhone) return actionError("Please enter a valid phone number.");

  const profile = await prisma.brokerProfile.findUnique({
    where: { brokerCode: (brokerCode ?? "").trim() },
    include: { user: { select: { id: true, role: true, status: true } } },
  });
  if (!profile || profile.user.status !== "ACTIVE") return actionError("This referral link is no longer active.");
  if (profile.user.role !== "MAIN_BROKER" && profile.user.role !== "REFERRAL_BROKER") {
    return actionError("This referral link is no longer active.");
  }
  const brokerId = profile.user.id;

  const windowStart = new Date(Date.now() - REFERRAL_SPAM_WINDOW_HOURS * 3600 * 1000);
  const recent = await prisma.lead.findFirst({
    where: {
      submittedById: brokerId,
      source: "SHARE_LINK",
      createdAt: { gte: windowStart },
      customer: { phoneNormalized: normalizedPhone },
    },
    select: { id: true },
  });
  if (recent) {
    return actionError("A referral for this phone was already submitted recently. Our team will contact you.");
  }

  const leadCode = await generateUniqueCode(async (c) => !!(await prisma.lead.findUnique({ where: { leadCode: c } })));
  const result = await prisma.$transaction(async (tx) => {
    // Serialize submissions for the same normalized phone so concurrent
    // requests cannot both create a customer or miss the duplicate review.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalizedPhone}))`;
    const existingCustomer = await tx.customer.findFirst({
      where: { phoneNormalized: normalizedPhone },
      orderBy: { createdAt: "asc" },
    });
    let customerId: string;
    let duplicate = false;
    let candidateId: string | null = null;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      duplicate = true;
      candidateId = existingCustomer.id;
    } else {
      const customerCode = await generateUniqueCode(async (c) => !!(await tx.customer.findUnique({ where: { customerCode: c } })));
      const created = await tx.customer.create({
        data: {
          customerCode,
          fullName: input.customerName,
          phoneOriginal: input.customerPhone,
          phoneNormalized: normalizedPhone,
          email: input.customerEmail ?? null,
          city: input.city ?? null,
          createdById: brokerId,
          consentAt: new Date(),
        },
      });
      customerId = created.id;
    }
    const lead = await tx.lead.create({
      data: {
        leadCode,
        customerId,
        submittedById: brokerId,
        source: "SHARE_LINK",
        preferredLocation: input.city ?? null,
        requirements: input.message ?? null,
        notes: `Referral via share link /share/${profile.brokerCode}`,
        priority: "MEDIUM",
        status: "NEW",
      },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: null, toStatus: "NEW", changedById: brokerId, reason: "Referral submitted via share link" },
    });
    if (duplicate && candidateId) {
      await tx.duplicateReview.create({ data: { leadId: lead.id, candidateCustomerId: candidateId, status: "PENDING" } });
    }
    return { leadCode: lead.leadCode };
  });

  await writeAudit({
    actorId: brokerId,
    action: "REFERRAL_SUBMITTED",
    targetType: "Lead",
    targetId: result.leadCode,
    summary: `Public referral via share link /share/${profile.brokerCode} (ref ${result.leadCode})`,
  });

  return actionSuccess({ reference: result.leadCode });
}
