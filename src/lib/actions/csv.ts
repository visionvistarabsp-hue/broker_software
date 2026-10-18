"use server";

import { requireUser, requireRole } from "@/lib/authz";
import {
  exportLeadsCsv,
  exportPropertiesCsv,
  exportCustomersCsv,
  importLeadsCsv,
  importPropertiesCsv,
  importCustomersCsv,
  type ExportResult,
  type ImportResult,
} from "@/lib/services/csv";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";

export type { ImportResult, ExportResult };

/** Server action wrapper for exporting leads to CSV. */
export async function exportLeadsAction(): Promise<ActionResult<ExportResult>> {
  const actor = await requireUser();
  try {
    return actionSuccess(await exportLeadsCsv(actor));
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to export leads.");
  }
}

/** Server action wrapper for exporting properties to CSV. */
export async function exportPropertiesAction(): Promise<ActionResult<ExportResult>> {
  const actor = await requireUser();
  try {
    return actionSuccess(await exportPropertiesCsv(actor));
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to export properties.");
  }
}

/** Server action wrapper for exporting customers to CSV. */
export async function exportCustomersAction(): Promise<ActionResult<ExportResult>> {
  const actor = await requireUser();
  try {
    return actionSuccess(await exportCustomersCsv(actor));
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to export customers.");
  }
}

/** Server action wrapper for importing leads from CSV text. */
export async function importLeadsAction(csvText: string): Promise<ActionResult<ImportResult>> {
  const actor = await requireRole("ADMIN", "MAIN_BROKER", "REFERRAL_BROKER");
  try {
    return await importLeadsCsv(actor, csvText);
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to import leads.");
  }
}

/** Server action wrapper for importing properties from CSV text. */
export async function importPropertiesAction(csvText: string): Promise<ActionResult<ImportResult>> {
  const actor = await requireRole("ADMIN", "MAIN_BROKER", "REFERRAL_BROKER");
  try {
    return await importPropertiesCsv(actor, csvText);
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to import properties.");
  }
}

/** Server action wrapper for importing customers from CSV text. */
export async function importCustomersAction(csvText: string): Promise<ActionResult<ImportResult>> {
  const actor = await requireRole("ADMIN", "MAIN_BROKER", "REFERRAL_BROKER");
  try {
    return await importCustomersCsv(actor, csvText);
  } catch (err: unknown) {
    if (err instanceof Error) return actionError(err.message);
    return actionError("Failed to import customers.");
  }
}
