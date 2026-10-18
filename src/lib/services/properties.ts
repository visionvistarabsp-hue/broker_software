import { prisma } from "@/lib/db";
import { requireRoleOf, AuthError, type SessionUser } from "@/lib/authz";
import { generateUniqueCode } from "@/lib/services/codes";
import { propertySchema, propertyUpdateSchema } from "@/lib/validation/property";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/validation/common";
import { writeAudit } from "@/lib/services/audit";
import type { PropertyStatus, ListingType } from "@prisma/client";

function canWrite(actor: SessionUser): boolean {
  return actor.role === "ADMIN" || actor.role === "MAIN_BROKER";
}

function sanitizeFor(actor: SessionUser, row: Record<string, unknown>) {
  if (actor.role === "ADMIN" || actor.role === "MAIN_BROKER") return row;
  const copy = { ...row };
  delete copy.ownerContact;
  return copy;
}

export async function listProperties(
  actor: SessionUser,
  opts?: { q?: string; city?: string; listingType?: string; status?: string; page?: number; pageSize?: number }
) {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const q = (opts?.q ?? "").trim();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status as PropertyStatus;
  if (opts?.listingType) where.listingType = opts.listingType as ListingType;
  if (opts?.city) where.city = { contains: opts.city, mode: "insensitive" };
  if (q) {
    where.AND = [
      { OR: [{ title: { contains: q, mode: "insensitive" } }, { propertyCode: { contains: q } }, { locality: { contains: q, mode: "insensitive" } }] },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.property.count({ where: where as never }),
    prisma.property.findMany({ where: where as never, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { total, page, pageSize, rows: rows.map((r) => sanitizeFor(actor, r as unknown as Record<string, unknown>)) };
}

export async function activePropertiesForLead(actor: SessionUser) {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  return prisma.property.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, propertyCode: true, title: true, city: true, locality: true, price: true, listingType: true, type: true },
  });
}

export async function createProperty(actor: SessionUser, raw: unknown): Promise<ActionResult<{ id: string; propertyCode: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  if (!canWrite(actor)) return actionError("Only admins and channel partners can manage properties.");
  const parsed = propertySchema.safeParse(raw);
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  if (parsed.data.price < 0) return actionError("Price cannot be negative.");
  const code = await generateUniqueCode(async (c) => !!(await prisma.property.findUnique({ where: { propertyCode: c } })));
  const created = await prisma.property.create({
    data: {
      propertyCode: code, title: parsed.data.title, type: parsed.data.type, listingType: parsed.data.listingType,
      address: parsed.data.address || null, city: parsed.data.city, locality: parsed.data.locality || null,
      price: parsed.data.price, priceMin: parsed.data.priceMin ?? null, priceMax: parsed.data.priceMax ?? null,
      area: parsed.data.area ?? null, areaUnit: parsed.data.areaUnit, bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null, furnishing: parsed.data.furnishing || null,
      description: parsed.data.description || null, status: parsed.data.status,
      verificationStatus: parsed.data.verificationStatus, ownerContact: parsed.data.ownerContact || null, createdById: actor.id,
    },
  });
  await writeAudit({ actorId: actor.id, action: "PROPERTY_CREATED", targetType: "Property", targetId: created.id, summary: `Property ${created.propertyCode} created` });
  return actionSuccess({ id: created.id, propertyCode: created.propertyCode });
}

export async function updateProperty(actor: SessionUser, id: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_BROKER") return actionError("Only admins and channel partners can manage properties.");
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) return actionError("Property not found.");
  const parsed = propertyUpdateSchema.safeParse(raw);
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  if (parsed.data.price !== undefined && parsed.data.price < 0) return actionError("Price cannot be negative.");
  await prisma.property.update({ where: { id }, data: { ...(parsed.data as Record<string, never>) } });
  await writeAudit({ actorId: actor.id, action: "PROPERTY_UPDATED", targetType: "Property", targetId: id, summary: `Property ${existing.propertyCode} updated` });
  return actionSuccess({ id });
}

export async function setPropertyStatus(actor: SessionUser, id: string, status: PropertyStatus): Promise<ActionResult<{ id: string }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_BROKER") return actionError("Only admins and channel partners can manage properties.");
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) return actionError("Property not found.");
  await prisma.property.update({ where: { id }, data: { status } });
  await writeAudit({ actorId: actor.id, action: "PROPERTY_STATUS_CHANGED", targetType: "Property", targetId: id, summary: `${existing.propertyCode}: ${existing.status} -> ${status}` });
  return actionSuccess({ id });

}

export async function activePropertiesForMatching(actor: SessionUser) {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  return prisma.property.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true, propertyCode: true, title: true, city: true, locality: true,
      price: true, listingType: true, type: true, bedrooms: true, bathrooms: true,
      area: true, areaUnit: true, status: true, updatedAt: true,
    },
  });
}
