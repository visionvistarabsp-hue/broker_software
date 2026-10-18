import { clsx, type ClassValue } from "clsx";
import type { Role } from "@prisma/client";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MAIN_BROKER: "Channel Partner",
  REFERRAL_BROKER: "Referral Partner",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
