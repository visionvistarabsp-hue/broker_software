import { z } from "zod";

export const PROPERTY_TYPES = [
  "APARTMENT",
  "VILLA",
  "HOUSE",
  "PLOT",
  "COMMERCIAL",
  "OFFICE",
  "SHOP",
  "LAND",
  "OTHER",
] as const;

export const LISTING_TYPES = ["SALE", "RENT", "LEASE"] as const;

export const PROPERTY_STATUSES = ["ACTIVE", "INACTIVE", "SOLD", "RENTED", "ARCHIVED"] as const;

const positiveInt = z.coerce.number().int().min(0);
const optionalPositiveInt = z.coerce.number().int().min(0).optional();
const optionalPositiveNumber = z.coerce.number().min(0).optional();

export const propertySchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(160),
    type: z.enum(PROPERTY_TYPES).default("APARTMENT"),
    listingType: z.enum(LISTING_TYPES).default("SALE"),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().min(2, "City is required").max(120),
    locality: z.string().trim().max(160).optional(),
    price: positiveInt,
    priceMin: optionalPositiveInt,
    priceMax: optionalPositiveInt,
    area: optionalPositiveNumber,
    areaUnit: z.string().trim().max(20).default("sq.ft."),
    bedrooms: optionalPositiveInt,
    bathrooms: optionalPositiveInt,
    furnishing: z.string().trim().max(60).optional(),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(PROPERTY_STATUSES).default("ACTIVE"),
    verificationStatus: z.string().trim().max(40).default("UNVERIFIED"),
    ownerContact: z.string().trim().max(200).optional(),
  })
  .refine(
    (d) => d.priceMin === undefined || d.priceMax === undefined || d.priceMin <= d.priceMax,
    { path: ["priceMax"], message: "Maximum price must be at least the minimum price" }
  )
  .refine(
    (d) =>
      d.priceMin === undefined ||
      d.priceMax === undefined ||
      (d.price >= d.priceMin && d.price <= d.priceMax) ||
      d.priceMin === 0,
    { path: ["price"], message: "Price should fall within the min/max range" }
  );

export type PropertyInput = z.infer<typeof propertySchema>;

export const propertyUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  listingType: z.enum(LISTING_TYPES).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  locality: z.string().trim().max(160).optional(),
  price: z.coerce.number().int().min(0).optional(),
  priceMin: z.coerce.number().int().min(0).nullable().optional(),
  priceMax: z.coerce.number().int().min(0).nullable().optional(),
  area: z.coerce.number().min(0).nullable().optional(),
  areaUnit: z.string().trim().max(20).optional(),
  bedrooms: z.coerce.number().int().min(0).nullable().optional(),
  bathrooms: z.coerce.number().int().min(0).nullable().optional(),
  furnishing: z.string().trim().max(60).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(PROPERTY_STATUSES).optional(),
  verificationStatus: z.string().trim().max(40).optional(),
  ownerContact: z.string().trim().max(200).optional(),
});
