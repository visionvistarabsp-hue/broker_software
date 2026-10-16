"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/authz";
import { setBrokerStatus } from "@/lib/services/brokers";

export async function approveBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "ACTIVE");
  revalidatePath("/admin/brokers");
}

export async function suspendBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "SUSPENDED");
  revalidatePath("/admin/brokers");
}

export async function reactivateBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "ACTIVE");
  revalidatePath("/admin/brokers");
}

export async function deactivateBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "DEACTIVATED");
  revalidatePath("/admin/brokers");
}
