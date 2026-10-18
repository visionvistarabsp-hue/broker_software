"use server";

import { requireUser } from "@/lib/authz";
import {
  createFollowUp,
  completeFollowUp,
  rescheduleFollowUp,
  cancelFollowUp,
} from "@/lib/services/followups";
import { scheduleVisit, completeVisit, cancelVisit } from "@/lib/services/sitevisits";
import { markRead, markAllRead } from "@/lib/services/notifications";
import { revalidatePath } from "next/cache";

function form(obj: FormData, key: string): string | undefined {
  const v = obj.get(key);
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export async function createFollowUpAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  await createFollowUp(actor, {
    leadId: form(formData, "leadId"),
    title: form(formData, "title"),
    description: form(formData, "description"),
    dueAt: form(formData, "dueAt"),
    priority: form(formData, "priority") || "MEDIUM",
    assignedToId: form(formData, "assignedToId"),
  });
  revalidatePath("/followups");
  revalidatePath("/calendar");
}

export async function completeFollowUpAction(id: string): Promise<void> {
  const actor = await requireUser();
  await completeFollowUp(actor, id);
  revalidatePath("/followups");
  revalidatePath("/calendar");
}

export async function rescheduleFollowUpAction(id: string, formData: FormData): Promise<void> {
  const actor = await requireUser();
  await rescheduleFollowUp(actor, id, {
    newDueAt: form(formData, "newDueAt"),
    reason: form(formData, "reason"),
  });
  revalidatePath("/followups");
  revalidatePath("/calendar");
}

export async function cancelFollowUpAction(id: string): Promise<void> {
  const actor = await requireUser();
  await cancelFollowUp(actor, id);
  revalidatePath("/followups");
  revalidatePath("/calendar");
}

export async function scheduleVisitAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  await scheduleVisit(actor, {
    leadId: form(formData, "leadId"),
    propertyId: form(formData, "propertyId"),
    scheduledAt: form(formData, "scheduledAt"),
    notes: form(formData, "notes"),
  });
  revalidatePath("/followups");
  revalidatePath("/calendar");
}

export async function completeVisitAction(id: string): Promise<void> {
  const actor = await requireUser();
  await completeVisit(actor, id);
  revalidatePath("/calendar");
}

export async function cancelVisitAction(id: string): Promise<void> {
  const actor = await requireUser();
  await cancelVisit(actor, id);
  revalidatePath("/calendar");
}

export async function markReadAction(id: string): Promise<void> {
  const actor = await requireUser();
  await markRead(actor, id);
  revalidatePath("/followups");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function markAllReadAction(): Promise<void> {
  const actor = await requireUser();
  await markAllRead(actor);
  revalidatePath("/followups");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
