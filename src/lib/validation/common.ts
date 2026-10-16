import { z } from "zod";
import { normalizePhone } from "@/lib/services/phone";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionError(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

export const optionalPhoneField = z
  .union([z.string().min(1), z.literal(""), z.undefined(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v : undefined));

export const normalizedOptionalPhone = z
  .union([z.string().min(1), z.literal(""), z.undefined(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return undefined;
    const normalized = normalizePhone(String(v));
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export function paginatedQuerySchema(defaults?: { page?: number; pageSize?: number }) {
  return z.object({
    q: z.string().max(100).optional().default(""),
    page: z.coerce.number().int().min(1).default(defaults?.page ?? 1),
    pageSize: z.coerce.number().int().min(1).max(100).default(defaults?.pageSize ?? 20),
  });
}

