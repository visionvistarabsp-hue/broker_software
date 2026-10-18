import { prisma } from "@/lib/db";
import { requireRoleOf, AuthError, type SessionUser } from "@/lib/authz";
import { generateUniqueCode } from "@/lib/services/codes";
import { customerSchema } from "@/lib/validation/crm";
import { actionError, actionSuccess, zodFieldErrors, type ActionResult } from "@/lib/validation/common";
import { writeAudit } from "@/lib/services/audit";

function maskPhone(phone: string): string {
  return phone.length > 4 ? `•••${phone.slice(-4)}` : "•••";
}

export async function listCustomers(
  actor: SessionUser,
  opts?: { q?: string; page?: number; pageSize?: number }
) {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  const q = (opts?.q ?? "").trim();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));

  const baseWhere =
    actor.role === "ADMIN"
      ? {}
      : { OR: [{ createdById: actor.id }, { ownerBrokerId: actor.id }] };

  const where = q
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { customerCode: { contains: q, mode: "insensitive" as const } },
              { phoneNormalized: { contains: q } },
              { city: { contains: q, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { leads: true } },
        ownerBroker: { include: { brokerProfile: true } },
        createdBy: { include: { brokerProfile: true } },
      },
    }),
  ]);

  const mask = actor.role === "ADMIN" ? false : true;
  const data = rows.map((c) => ({
    ...c,
    phoneOriginal: mask ? maskPhone(c.phoneNormalized) : c.phoneOriginal,
    email: mask ? (c.email ? "•••" : null) : c.email,
  }));

  return { total, page, pageSize, rows: data };
}

export async function createCustomer(
  actor: SessionUser,
  raw: unknown
): Promise<ActionResult<{ id: string; customerCode: string; duplicate: boolean }>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  if (actor.role !== "ADMIN" && actor.role !== "MAIN_BROKER") {
    return actionError("Only admins and channel partners can add customers.");
  }
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));

  const existing = await prisma.customer.findFirst({
    where: { phoneNormalized: parsed.data.phone },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    // Preserve original attribution — never silently overwrite.
    await writeAudit({
      actorId: actor.id,
      action: "CUSTOMER_DUPLICATE_ATTEMPT",
      targetType: "Customer",
      targetId: existing.id,
      summary: `Duplicate customer attempt for ${maskPhone(parsed.data.phone)} (existing ${existing.customerCode})`,
    });
    return actionSuccess({ id: existing.id, customerCode: existing.customerCode, duplicate: true });
  }

  const code = await generateUniqueCode(
    async (c) => !!(await prisma.customer.findUnique({ where: { customerCode: c } }))
  );

  const created = await prisma.customer.create({
    data: {
      customerCode: code,
      fullName: parsed.data.fullName.trim(),
      phoneOriginal: String((raw as { phoneOriginal?: string })?.phoneOriginal ?? parsed.data.phone),
      phoneNormalized: parsed.data.phone,
      email: parsed.data.email?.trim() || null,
      address: parsed.data.address?.trim() || null,
      city: parsed.data.city?.trim() || null,
      ownerBrokerId: parsed.data.ownerBrokerId ?? (actor.role === "MAIN_BROKER" ? actor.id : null),
      createdById: actor.id,
      consentAt: new Date(),
    },
  });

  await writeAudit({
    actorId: actor.id,
    action: "CUSTOMER_CREATED",
    targetType: "Customer",
    targetId: created.id,
    summary: `Customer ${created.customerCode} created`,
  });

  return actionSuccess({ id: created.id, customerCode: created.customerCode, duplicate: false });
}

export async function getCustomer(actor: SessionUser, id: string) {
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const row = await prisma.customer.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { property: true },
      },
      ownerBroker: { include: { brokerProfile: true } },
    },
  });
  if (!row) throw new AuthError(404, "Customer not found");
  if (actor.role !== "ADMIN" && row.createdById !== actor.id && row.ownerBrokerId !== actor.id) {
    const relatedLead = await prisma.lead.findFirst({
      where: { customerId: id, OR: [{ submittedById: actor.id }, { assignedToId: actor.id }] },
      select: { id: true },
    });
    if (!relatedLead) throw new AuthError(403, "Forbidden");
  }
  return row;
}
