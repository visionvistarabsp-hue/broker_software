"use server";

import { requireUser, requireRole } from "@/lib/authz";
import { createCustomer } from "@/lib/services/customers";
import { matchLeadToProperties, type MatchResult } from "@/lib/services/matching";
import {
  createProperty,
  updateProperty,
  setPropertyStatus,
  activePropertiesForMatching,
} from "@/lib/services/properties";
import { submitLead, changeLeadStatus, resolveDuplicate, getLead } from "@/lib/services/leads";
import { redirect } from "next/navigation";
import type { LeadStatus, PropertyStatus } from "@prisma/client";

function form(obj: FormData, key: string): string | undefined {
  const v = obj.get(key);
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const actor = await requireRole("ADMIN", "MAIN_BROKER");
  const res = await createCustomer(actor, {
    fullName: form(formData, "fullName"),
    phone: form(formData, "phone"),
    email: form(formData, "email") ?? "",
    address: form(formData, "address") ?? "",
    city: form(formData, "city") ?? "",
  });
  if (!res.ok) return;
  redirect("/customers");
}

export async function createPropertyAction(formData: FormData) {
  const actor = await requireRole("ADMIN", "MAIN_BROKER");
  const num = (k: string) => {
    const v = form(formData, k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const res = await createProperty(actor, {
    title: form(formData, "title"),
    type: form(formData, "type") || "APARTMENT",
    listingType: form(formData, "listingType") || "SALE",
    address: form(formData, "address") ?? "",
    city: form(formData, "city"),
    locality: form(formData, "locality") ?? "",
    price: num("price") ?? 0,
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    area: num("area"),
    bedrooms: num("bedrooms"),
    bathrooms: num("bathrooms"),
    furnishing: form(formData, "furnishing") ?? "",
    description: form(formData, "description") ?? "",
    ownerContact: form(formData, "ownerContact") ?? "",
  });
  if (!res.ok) return res;
  redirect("/properties");
}

export async function updatePropertyAction(id: string, formData: FormData) {
  const actor = await requireRole("ADMIN", "MAIN_BROKER");
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "type", "listingType", "address", "city", "locality", "furnishing", "description", "status", "verificationStatus", "ownerContact"]) {
    const v = form(formData, k);
    if (v !== undefined) patch[k] = v;
  }
  for (const k of ["price", "priceMin", "priceMax", "area", "bedrooms", "bathrooms"]) {
    const v = form(formData, k);
    if (v !== undefined) patch[k] = Number(v);
  }
  const res = await updateProperty(actor, id, patch);
  if (!res.ok) return res;
  redirect(`/properties/${id}`);
}

export async function setPropertyStatusAction(id: string, status: PropertyStatus) {
  const actor = await requireRole("ADMIN", "MAIN_BROKER");
  const res = await setPropertyStatus(actor, id, status);
  return res;
}

export async function submitLeadAction(formData: FormData) {
  const actor = await requireUser();
  const num = (k: string) => {
    const v = form(formData, k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const res = await submitLead(actor, {
    customerName: form(formData, "customerName"),
    customerPhone: form(formData, "customerPhone"),
    customerEmail: form(formData, "customerEmail") ?? "",
    customerAddress: form(formData, "customerAddress") ?? "",
    customerCity: form(formData, "customerCity") ?? "",
    propertyId: form(formData, "propertyId"),
    budgetMin: num("budgetMin"),
    budgetMax: num("budgetMax"),
    preferredLocation: form(formData, "preferredLocation") ?? "",
    requirements: form(formData, "requirements") ?? "",
    notes: form(formData, "notes") ?? "",
    priority: form(formData, "priority") || "MEDIUM",
  });
  if (!res.ok) return res;
  redirect(`/leads/${res.data.leadId}`);
}

export async function changeLeadStatusAction(leadId: string, formData: FormData): Promise<void> {
  const actor = await requireUser();
  await changeLeadStatus(
    actor,
    leadId,
    String(formData.get("status")) as LeadStatus,
    form(formData, "reason"),
    form(formData, "lostReason")
  );
}

export async function resolveDuplicateAction(leadId: string, formData: FormData): Promise<void> {
  const actor = await requireRole("ADMIN");
  const decision = String(formData.get("decision")) as "LINKED" | "DISTINCT_APPROVED" | "REJECTED";
  const res = await resolveDuplicate(actor, leadId, decision, form(formData, "reason"));
  if (!res.ok) return;
  redirect("/duplicates");

}

export async function matchLeadAction(leadId: string): Promise<{
  ok: boolean;
  matches?: MatchResult[];
  error?: string;
}> {
  const actor = await requireUser();
  let lead;
  try {
    lead = await getLead(actor, leadId);
  } catch {
    return { ok: false, error: "Lead not found or you do not have access to it." };
  }
  const properties = await activePropertiesForMatching(actor);
  const matches = matchLeadToProperties(
    {
      id: lead.id,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      preferredLocation: lead.preferredLocation,
      requirements: lead.requirements,
      createdAt: lead.createdAt,
    },
    properties.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      city: p.city,
      locality: p.locality,
      type: p.type,
      listingType: p.listingType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area,
      status: p.status,
      updatedAt: p.updatedAt,
    })),
  );
  return { ok: true, matches };
}
