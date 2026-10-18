"use server";

import { requireUser } from "@/lib/authz";
import { addCollaborator, removeCollaborator } from "@/lib/services/collaboration";
import { submitReferral } from "@/lib/services/referral";

function form(obj: FormData, key: string): string | undefined {
  const v = obj.get(key);
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export async function addCollaboratorAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireUser();
  const res = await addCollaborator(actor, {
    leadId: form(formData, "leadId"),
    brokerId: form(formData, "brokerId"),
    role: form(formData, "role") ?? "CO_BROKER",
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function removeCollaboratorAction(leadId: string, brokerId: string): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireUser();
  const res = await removeCollaborator(actor, leadId, brokerId);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function submitReferralAction(brokerCode: string, formData: FormData): Promise<{ ok: boolean; reference?: string; error?: string }> {
  const res = await submitReferral(brokerCode, {
    customerName: form(formData, "customerName"),
    customerPhone: form(formData, "customerPhone"),
    customerEmail: form(formData, "customerEmail") ?? "",
    city: form(formData, "city") ?? "",
    message: form(formData, "message") ?? "",
  });
  return res.ok ? { ok: true, reference: res.data.reference } : { ok: false, error: res.error };
}
