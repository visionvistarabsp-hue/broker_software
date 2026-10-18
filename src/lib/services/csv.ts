import { prisma } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  Export helpers                                                    */
/* ------------------------------------------------------------------ */

function leadScope(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  return { OR: [{ submittedById: actor.id }, { assignedToId: actor.id }, { collaborators: { some: { brokerId: actor.id } } }] };
}

function propertyScope(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  return { createdById: actor.id };
}

function customerScope(actor: SessionUser): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};
  return { OR: [{ createdById: actor.id }, { ownerBrokerId: actor.id }] };
}

export async function exportLeadsCsv(actor: SessionUser): Promise<ExportResult> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const rows = await prisma.lead.findMany({
    where: leadScope(actor) as never,
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      property: { select: { title: true, propertyCode: true } },
      submittedBy: { select: { id: true, email: true } },
      assignedTo: { select: { id: true, email: true } },
    },
  });
  const csv = stringifyCsv([
    [
      "leadCode",
      "customerName",
      "customerPhone",
      "customerEmail",
      "source",
      "propertyId",
      "propertyTitle",
      "propertyCode",
      "budgetMin",
      "budgetMax",
      "preferredLocation",
      "requirements",
      "notes",
      "status",
      "priority",
      "submittedBy",
      "assignedTo",
      "createdAt",
    ],
    ...rows.map((l) => [
      l.leadCode,
      l.customer.fullName,
      l.customer.phoneOriginal,
      l.customer.email ?? "",
      l.source,
      l.propertyId ?? "",
      l.property?.title ?? "",
      l.property?.propertyCode ?? "",
      String(l.budgetMin ?? ""),
      String(l.budgetMax ?? ""),
      l.preferredLocation ?? "",
      l.requirements ?? "",
      l.notes ?? "",
      l.status,
      l.priority,
      l.submittedBy.email ?? l.submittedBy.id,
      l.assignedTo?.email ?? l.assignedTo?.id ?? "",
      l.createdAt.toISOString(),
    ]),
  ]);
  const result: ExportResult = {
    kind: "lead",
    filename: `leads-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    rowCount: rows.length,
  };
  await writeAudit({
    actorId: actor.id,
    action: "LEADS_EXPORTED",
    targetType: "Lead",
    summary: `Exported ${rows.length} leads to CSV`,
  });
  return result;
}

import type { SessionUser } from "@/lib/authz";
import { AuthError, requireRoleOf } from "@/lib/authz";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";
import {
  leadCsvRowSchema,
  propertyCsvRowSchema,
  customerCsvRowSchema,
  type CsvKind,
  type ImportResult,
  type ExportResult,
  type LeadCsvRow,
  type PropertyCsvRow,
  type CustomerCsvRow,
} from "@/lib/validation/csv";
import { writeAudit } from "@/lib/services/audit";
import type { LeadStatus, PropertyStatus, PrismaClient } from "@prisma/client";

/** Maximum import rows per request to keep imports bounded. */
const MAX_IMPORT_ROWS = 500;

/* ------------------------------------------------------------------ */
/*  Minimal RFC 4180 style CSV parser / stringifier (no external dep) */
/* ------------------------------------------------------------------ */

/**
 * Parse CSV text into rows of cells. Handles quoted fields, embedded
 * commas/newlines inside quotes and doubled-quote escaping.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  // Trailing cell / row (handles files without a trailing newline).
  if (cell.length > 0 || row.length > 0 || inQuotes) {
    pushCell();
    rows.push(row);
  }
  return rows;
}

/** Stringify an array of rows into CSV text (quotes cells containing , " or newline). */
export function stringifyCsv(rows: string[][]): string {
  const escape = (v: string) => {
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  if (rows.length === 0) return "";
  return rows.map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

/**
 * Parse CSV text where the first row is the header. Returns header names
 * trimmed and row objects keyed by header. Duplicate headers get a numeric
 * suffix so later columns are still addressable.
 */
export function parseCsvWithHeader(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const raw = parseCsv(text);
  if (raw.length === 0) return { headers: [], rows: [] };
  const rawHeaders = raw[0];
  const headers: string[] = [];
  const seen = new Map<string, number>();
  for (const h of rawHeaders) {
    const key = (h ?? "").trim();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    headers.push(count === 0 ? key : `${key}__${count}`);
  }
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < raw.length; r++) {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = raw[r]?.[c] ?? "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}

export async function exportPropertiesCsv(actor: SessionUser): Promise<ExportResult> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const rows = await prisma.property.findMany({
    where: propertyScope(actor) as never,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, email: true } } },
  });
  const csv = stringifyCsv([
    [
      "propertyCode",
      "title",
      "type",
      "listingType",
      "address",
      "city",
      "locality",
      "price",
      "priceMin",
      "priceMax",
      "area",
      "bedrooms",
      "bathrooms",
      "furnishing",
      "description",
      "ownerContact",
      "status",
      "verificationStatus",
      "createdBy",
      "createdAt",
    ],
    ...rows.map((p) => [
      p.propertyCode,
      p.title,
      p.type,
      p.listingType,
      p.address ?? "",
      p.city,
      p.locality ?? "",
      String(p.price),
      String(p.priceMin ?? ""),
      String(p.priceMax ?? ""),
      String(p.area ?? ""),
      String(p.bedrooms ?? ""),
      String(p.bathrooms ?? ""),
      p.furnishing ?? "",
      p.description ?? "",
      p.ownerContact ?? "",
      p.status,
      p.verificationStatus,
      p.createdBy?.email ?? p.createdById ?? "",
      p.createdAt.toISOString(),
    ]),
  ]);
  const result: ExportResult = {
    kind: "property",
    filename: `properties-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    rowCount: rows.length,
  };
  await writeAudit({
    actorId: actor.id,
    action: "PROPERTIES_EXPORTED",
    targetType: "Property",
    summary: `Exported ${rows.length} properties to CSV`,
  });
  return result;
}

export async function exportCustomersCsv(actor: SessionUser): Promise<ExportResult> {
  if (actor.status !== "ACTIVE") throw new AuthError(403, "Account is not active");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);
  const rows = await prisma.customer.findMany({
    where: customerScope(actor) as never,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, email: true } }, ownerBroker: { select: { id: true, email: true } } },
  });
  const csv = stringifyCsv([
    [
      "customerCode",
      "fullName",
      "phoneOriginal",
      "phoneNormalized",
      "email",
      "address",
      "city",
      "ownerBrokerId",
      "ownerBrokerEmail",
      "createdBy",
      "createdAt",
    ],
    ...rows.map((c) => [
      c.customerCode,
      c.fullName,
      c.phoneOriginal,
      c.phoneNormalized,
      c.email ?? "",
      c.address ?? "",
      c.city ?? "",
      c.ownerBrokerId ?? "",
      c.ownerBroker?.email ?? "",
      c.createdBy.email ?? c.createdById,
      c.createdAt.toISOString(),
    ]),
  ]);
  const result: ExportResult = {
    kind: "customer",
    filename: `customers-export-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    rowCount: rows.length,
  };
  await writeAudit({
    actorId: actor.id,
    action: "CUSTOMERS_EXPORTED",
    targetType: "Customer",
    summary: `Exported ${rows.length} customers to CSV`,
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  Import helpers                                                    */
/* ------------------------------------------------------------------ */

function rowError(row: number, field: string, message: string): ImportResult["errors"][number] {
  return { row, field, message };
}

function toFieldErrors(errors: ImportResult["errors"]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    const key = `Row ${e.row}`;
    if (out[key]) out[key].push(`${e.field}: ${e.message}`);
    else out[key] = [`${e.field}: ${e.message}`];
  }
  return out;
}

export async function importLeadsCsv(
  actor: SessionUser,
  csvText: string
): Promise<ActionResult<ImportResult>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const { rows } = parseCsvWithHeader(csvText);
  if (rows.length === 0) return actionError("No data rows found in the CSV.");
  if (rows.length > MAX_IMPORT_ROWS)
    return actionError(`CSV has ${rows.length} rows; maximum allowed is ${MAX_IMPORT_ROWS}.`);

  const parsed: { row: number; data: LeadCsvRow }[] = [];
  const fieldErrors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 header, +1 one-based
    const parsedRow = leadCsvRowSchema.safeParse(rows[i]);
    if (!parsedRow.success) {
      const flat = parsedRow.error.flatten().fieldErrors as Record<string, string[]>;
      for (const [field, msgs] of Object.entries(flat)) {
        for (const msg of msgs) fieldErrors.push(rowError(rowNumber, field, msg));
      }
      continue;
    }
    parsed.push({ row: rowNumber, data: parsedRow.data });
  }

  if (fieldErrors.length > 0) {
    return actionError(`Import failed: ${fieldErrors.length} cell error(s) found.`, toFieldErrors(fieldErrors));
  }

  const importedIds: string[] = [];
  let skipped = 0;

  // Validate any referenced properties up front.
  const propertyIds = [...new Set(parsed.map((p) => p.data.propertyId).filter(Boolean))] as string[];
  const existingProperties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, status: true },
  });
  const propertyStatusById = new Map(existingProperties.map((p) => [p.id, p.status]));

  const result = await prisma.$transaction(async (tx) => {
    for (const { row, data } of parsed) {
      if (data.propertyId && !propertyStatusById.has(data.propertyId)) {
        skipped++;
        continue;
      }
      if (data.propertyId && propertyStatusById.get(data.propertyId) !== "ACTIVE") {
        skipped++;
        continue;
      }
      let assignedToId: string | null = null;
      if (data.assignedToId) {
        if (actor.role !== "ADMIN") {
          skipped++;
          continue;
        }
        const target = await tx.user.findUnique({ where: { id: data.assignedToId } });
        if (!target || target.status !== "ACTIVE") {
          skipped++;
          continue;
        }
        assignedToId = target.id;
      }
      const customer = await tx.customer.create({
        data: {
          customerCode: await generateUniqueCodeScoped(tx, "customer"),
          fullName: data.customerName.trim(),
          phoneOriginal: data.customerPhone,
          phoneNormalized: data.customerPhone,
          email: data.customerEmail ?? null,
          address: data.customerAddress ?? null,
          city: data.customerCity ?? null,
          ownerBrokerId: actor.role === "MAIN_BROKER" ? actor.id : null,
          createdById: actor.id,
          consentAt: new Date(),
        },
      });
      const leadCode = await generateUniqueCodeScoped(tx, "lead");
      const lead = await tx.lead.create({
        data: {
          leadCode,
          customerId: customer.id,
          submittedById: actor.id,
          source: data.source,
          propertyId: data.propertyId ?? null,
          budgetMin: data.budgetMin ?? null,
          budgetMax: data.budgetMax ?? null,
          preferredLocation: data.preferredLocation ?? null,
          requirements: data.requirements ?? null,
          notes: data.notes ?? null,
          priority: data.priority,
          assignedToId,
          status: "NEW",
        },
      });
      await tx.leadStatusHistory.create({
        data: { leadId: lead.id, fromStatus: null, toStatus: "NEW", changedById: actor.id, reason: "Imported via CSV" },
      });
      importedIds.push(lead.id);
    }
    return importedIds;
  });

  await writeAudit({
    actorId: actor.id,
    action: "LEADS_IMPORTED",
    targetType: "Lead",
    summary: `Imported ${importedIds.length} leads from CSV (skipped ${skipped})`,
  });
  return actionSuccess<ImportResult>({
    kind: "lead",
    totalRows: rows.length,
    imported: importedIds.length,
    skipped,
    errors: [],
    ids: importedIds,
  });
}

export async function importPropertiesCsv(
  actor: SessionUser,
  csvText: string
): Promise<ActionResult<ImportResult>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const { rows } = parseCsvWithHeader(csvText);
  if (rows.length === 0) return actionError("No data rows found in the CSV.");
  if (rows.length > MAX_IMPORT_ROWS)
    return actionError(`CSV has ${rows.length} rows; maximum allowed is ${MAX_IMPORT_ROWS}.`);

  const parsed: { row: number; data: PropertyCsvRow }[] = [];
  const fieldErrors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsedRow = propertyCsvRowSchema.safeParse(rows[i]);
    if (!parsedRow.success) {
      const flat = parsedRow.error.flatten().fieldErrors as Record<string, string[]>;
      for (const [field, msgs] of Object.entries(flat)) {
        for (const msg of msgs) fieldErrors.push(rowError(rowNumber, field, msg));
      }
      continue;
    }
    parsed.push({ row: rowNumber, data: parsedRow.data });
  }

  if (fieldErrors.length > 0) {
    return actionError(`Import failed: ${fieldErrors.length} cell error(s) found.`, toFieldErrors(fieldErrors));
  }

  const importedIds: string[] = [];
  let skipped = 0;

  const result = await prisma.$transaction(async (tx) => {
    for (const { data } of parsed) {
      const propertyCode = await generateUniqueCodeScoped(tx, "property");
      const property = await tx.property.create({
        data: {
          propertyCode,
          title: data.title.trim(),
          type: data.type,
          listingType: data.listingType,
          address: data.address ?? null,
          city: data.city.trim(),
          locality: data.locality ?? null,
          price: data.price,
          priceMin: data.priceMin ?? null,
          priceMax: data.priceMax ?? null,
          area: data.area ?? null,
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          furnishing: data.furnishing ?? null,
          description: data.description ?? null,
          ownerContact: data.ownerContact ?? null,
          status: data.status,
          createdById: actor.id,
        },
      });
      importedIds.push(property.id);
    }
    return importedIds;
  });

  await writeAudit({
    actorId: actor.id,
    action: "PROPERTIES_IMPORTED",
    targetType: "Property",
    summary: `Imported ${importedIds.length} properties from CSV`,
  });
  return actionSuccess<ImportResult>({
    kind: "property",
    totalRows: rows.length,
    imported: importedIds.length,
    skipped,
    errors: [],
    ids: importedIds,
  });
}

export async function importCustomersCsv(
  actor: SessionUser,
  csvText: string
): Promise<ActionResult<ImportResult>> {
  if (actor.status !== "ACTIVE") return actionError("Account is not active.");
  requireRoleOf(actor, ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"]);

  const { rows } = parseCsvWithHeader(csvText);
  if (rows.length === 0) return actionError("No data rows found in the CSV.");
  if (rows.length > MAX_IMPORT_ROWS)
    return actionError(`CSV has ${rows.length} rows; maximum allowed is ${MAX_IMPORT_ROWS}.`);

  const parsed: { row: number; data: CustomerCsvRow }[] = [];
  const fieldErrors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsedRow = customerCsvRowSchema.safeParse(rows[i]);
    if (!parsedRow.success) {
      const flat = parsedRow.error.flatten().fieldErrors as Record<string, string[]>;
      for (const [field, msgs] of Object.entries(flat)) {
        for (const msg of msgs) fieldErrors.push(rowError(rowNumber, field, msg));
      }
      continue;
    }
    parsed.push({ row: rowNumber, data: parsedRow.data });
  }

  if (fieldErrors.length > 0) {
    return actionError(`Import failed: ${fieldErrors.length} cell error(s) found.`, toFieldErrors(fieldErrors));
  }

  const importedIds: string[] = [];
  let skipped = 0;

  const result = await prisma.$transaction(async (tx) => {
    for (const { data } of parsed) {
      // Skip duplicates on normalized phone within this import batch + existing.
      const existing = await tx.customer.findFirst({
        where: { phoneNormalized: data.phone },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const customer = await tx.customer.create({
        data: {
          customerCode: await generateUniqueCodeScoped(tx, "customer"),
          fullName: data.fullName.trim(),
          phoneOriginal: data.phone,
          phoneNormalized: data.phone,
          email: data.email ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          ownerBrokerId: actor.role === "MAIN_BROKER" ? actor.id : null,
          createdById: actor.id,
          consentAt: new Date(),
        },
      });
      importedIds.push(customer.id);
    }
    return importedIds;
  });

  await writeAudit({
    actorId: actor.id,
    action: "CUSTOMERS_IMPORTED",
    targetType: "Customer",
    summary: `Imported ${importedIds.length} customers from CSV (skipped ${skipped} duplicate phones)`,
  });
  return actionSuccess<ImportResult>({
    kind: "customer",
    totalRows: rows.length,
    imported: importedIds.length,
    skipped,
    errors: [],
    ids: importedIds,
  });
}

/** Client exposed inside a Prisma transaction (connection methods stripped). */
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/**
 * Generate a unique code scoped to a model prefix inside an active
 * transaction. Mirrors codes.service behaviour without an extra dep.
 */
async function generateUniqueCodeScoped(
  tx: TxClient,
  prefix: "lead" | "property" | "customer"
): Promise<string> {
  const codeMap: Record<string, string> = { lead: "LD", property: "PR", customer: "CU" };
  const tableMap: Record<string, string> = { lead: "lead", property: "property", customer: "customer" };
  const fieldMap: Record<string, string> = { lead: "leadCode", property: "propertyCode", customer: "customerCode" };
  const codePrefix = codeMap[prefix];
  const table = tableMap[prefix] as "lead" | "property" | "customer";
  const field = fieldMap[prefix];
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${codePrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await (
      (tx as unknown as PrismaClient)[table] as unknown as { findUnique: (args: unknown) => Promise<unknown> }
    ).findUnique({ where: { [field]: code } as never });
    if (!exists) return code;
  }
  throw new Error(`Failed to generate unique ${prefix} code`);
}

export const supportedKinds: CsvKind[] = ["lead", "property", "customer"];
export type { ImportResult, ExportResult };




