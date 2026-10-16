import { z } from "zod";
import { normalizedPhoneField } from "@/lib/validation/auth";

export const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  phone: normalizedPhoneField,
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional().transform((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined)),
  address: z.string().trim().max(300).optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  city: z.string().trim().max(120).optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  ownerBrokerId: z.string().min(1).optional(),
});

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT",
  "NEGOTIATION",
  "CONVERTED",
  "LOST",
] as const;

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const LEAD_TRANSITIONS: Record<(typeof LEAD_STATUSES)[number], (typeof LEAD_STATUSES)[number][]> = {
  NEW: ["CONTACTED", "QUALIFIED", "LOST"],
  CONTACTED: ["QUALIFIED", "SITE_VISIT", "LOST"],
  QUALIFIED: ["SITE_VISIT", "NEGOTIATION", "LOST"],
  SITE_VISIT: ["NEGOTIATION", "QUALIFIED", "LOST"],
  NEGOTIATION: ["CONVERTED", "LOST", "SITE_VISIT"],
  CONVERTED: [],
  LOST: ["NEW", "CONTACTED"],
};

export function isValidLeadTransition(from: string, to: string): boolean {
  const allowed = LEAD_TRANSITIONS[from as keyof typeof LEAD_TRANSITIONS];
  if (!allowed) return false;
  return allowed.includes(to as (typeof LEAD_STATUSES)[number]);
}

export const leadCreateSchema = z
  .object({
    customerName: z.string().trim().min(2, "Customer name is required").max(120),
    customerPhone: normalizedPhoneField,
    customerEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
    customerAddress: z.string().trim().max(300).optional(),
    customerCity: z.string().trim().max(120).optional(),
    propertyId: z.string().min(1).optional(),
    budgetMin: z.coerce.number().int().min(0).optional(),
    budgetMax: z.coerce.number().int().min(0).optional(),
    preferredLocation: z.string().trim().max(160).optional(),
    requirements: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    priority: z.enum(LEAD_PRIORITIES).default("MEDIUM"),
    assignedToId: z.string().min(1).optional(),
    source: z.string().trim().max(60).default("REFERRAL"),
  })
  .refine(
    (d) =>
      d.budgetMin === undefined || d.budgetMax === undefined || d.budgetMin <= d.budgetMax,
    { path: ["budgetMax"], message: "Maximum budget must be at least the minimum budget" }
  );

export const leadStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  reason: z.string().trim().max(500).optional(),
  lostReason: z.string().trim().max(500).optional(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
