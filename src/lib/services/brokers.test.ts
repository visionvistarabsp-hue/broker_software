import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { listBrokers, setBrokerStatus } from "./brokers";
import { AuthError } from "@/lib/authz";

const admin = { id: "admin1", role: "ADMIN" as const, status: "ACTIVE" as const };
const broker = { id: "b1", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const PHONE = "+919990000005";

describe("brokers service", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.brokerProfile.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
    await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  });

  it("admin can list brokers", async () => {
    await prisma.user.create({ data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "MAIN_BROKER", status: "PENDING" } });
    const rows = await listBrokers(admin);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("non-admin cannot list brokers", async () => {
    await expect(listBrokers(broker)).rejects.toBeInstanceOf(AuthError);
  });

  it("suspending revokes sessions", async () => {
    const u = await prisma.user.create({ data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "MAIN_BROKER", status: "ACTIVE" } });
    await prisma.session.create({ data: { userId: u.id, tokenHash: "h1", expiresAt: new Date(Date.now() + 1e6) } });
    await setBrokerStatus(admin, u.id, "SUSPENDED");
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });
});
