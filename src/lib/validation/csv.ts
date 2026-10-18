import { z } from "zod";
import { normalizedPhoneField } from "@/lib/validation/auth";
import { LEAD_PRIORITIES } from "@/lib/validation/crm";

/** Shared optional trimmed string; empty -> undefined. */
export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined));

/** Optional non-negative integer from a raw CSV cell (empty -> undefined). */
export const optionalInt = z
  .preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : undefined;
    },
    z.number().int().min(0).optional()
  )
  .optional();

/** Optional email; empty -> undefined. */
export const optionalEmail = z
  .union([z.string().trim().email("Enter a valid email"), z.literal("")])
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined));

/** One row of a lead import CSV. */
export const leadCsvRowSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(120),
  customerPhone: normalizedPhoneField,
  customerEmail: optionalEmail,
  customerAddress: optionalString,
  customerCity: optionalString,
  propertyId: z.string().trim().min(1).optional(),
  budgetMin: optionalInt,
  budgetMax: optionalInt,
  preferredLocation: optionalString,
  requirements: optionalString,
  notes: optionalString,
  priority: z.enum(LEAD_PRIORITIES).default("MEDIUM"),
  source: z.string().trim().min(1).max(60).default("REFERRAL"),
  assignedToId: z.string().trim().min(1).optional(),
});

/** One row of a property import CSV. */
export const propertyCsvRowSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  type: z.enum(["APARTMENT", "VILLA", "HOUSE", "PLOT", "COMMERCIAL", "OFFICE", "SHOP", "LAND", "OTHER"]).default("APARTMENT"),
  listingType: z.enum(["SALE", "RENT", "LEASE"]).default("SALE"),
  address: optionalString,
  city: z.string().trim().min(1, "City is required").max(120),
  locality: optionalString,
  price: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : undefined;
    },
    z.number().int().min(0)
  ),
  priceMin: optionalInt,
  priceMax: optionalInt,
  area: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    z.number().nonnegative().optional()
  ),
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  furnishing: optionalString,
  description: optionalString,
  ownerContact: optionalString,
  status: z.enum(["ACTIVE", "INACTIVE", "SOLD", "RENTED", "ARCHIVED"]).default("ACTIVE"),
});

/** One row of a customer import CSV. */
export const customerCsvRowSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  phone: normalizedPhoneField,
  email: optionalEmail,
  address: optionalString,
  city: optionalString,
});

export type LeadCsvRow = z.infer<typeof leadCsvRowSchema>;
export type PropertyCsvRow = z.infer<typeof propertyCsvRowSchema>;
export type CustomerCsvRow = z.infer<typeof customerCsvRowSchema>;

export type CsvKind = "lead" | "property" | "customer";

export interface ImportResult {
  kind: CsvKind;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  ids: string[];
}

export interface ExportResult {
  kind: CsvKind;
  filename: string;
  csv: string;
  rowCount: number;
}
