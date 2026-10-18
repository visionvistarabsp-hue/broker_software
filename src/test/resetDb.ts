import { prisma } from "@/lib/db";

/**
 * Clear all application data in a single round trip.
 *
 * The integration suites share a single PostgreSQL database, so each suite
 * must start from a clean slate regardless of what other suites left behind.
 * A single `TRUNCATE ... CASCADE` replaces ~21 sequential `deleteMany()`
 * calls: CASCADE resolves the foreign-key ordering for us, `RESTART IDENTITY`
 * resets any sequences, and one statement avoids the per-call latency of a
 * remote database.
 *
 * Model names match table names (no `@@map` in schema.prisma), so the list
 * below mirrors the models exactly.
 */
const TRUNCATE_ALL = `TRUNCATE TABLE
  "PayoutHistory",
  "Payout",
  "Commission",
  "CommissionRule",
  "DealCollaborator",
  "PropertyDocument",
  "Notification",
  "FollowUp",
  "SiteVisit",
  "LeadStatusHistory",
  "DuplicateReview",
  "Lead",
  "Customer",
  "Property",
  "AuditLog",
  "OtpChallenge",
  "PasswordSetupToken",
  "PendingRegistration",
  "Session",
  "BrokerProfile",
  "User"
RESTART IDENTITY CASCADE`;

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(TRUNCATE_ALL);
}
