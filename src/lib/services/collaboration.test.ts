import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { addCollaborator, removeCollaborator, listCollaborators } from "./collaboration";
import { computeReputationScore } from "./reputation";
import { resetDb } from "@/test/resetDb";

let seq = 0;
function phone() {
  seq += 1;
  return `+9198800${String(seq).padStart(5, "0")}`;
}

function userEmail() {
  seq += 1;
  return `collab-user-${seq}@example.com`;
}

async function makeUser(role: "ADMIN" | "MAIN_BROKER" | "REFERRAL_BROKER") {
  return prisma.user.create({
    data: { email: userEmail(), role, status: "ACTIVE" },
  });
}

async function makeLead(submitterId: string, n: number) {
  const custPhone = phone();
  const cust = await prisma.customer.create({
    data: {
      customerCode: `CC${n}${Date.now()}`,
      fullName: "C",
      phoneOriginal: custPhone,
      phoneNormalized: custPhone,
      createdById: submitterId,
    },
  });
  return prisma.lead.create({
    data: { leadCode: `LL${n}${Date.now()}`, customerId: cust.id, submittedById: submitterId, status: "NEW", priority: "MEDIUM", source: "REFERRAL" },
  });
}

const asSession = (u: { id: string; role: string; status: string }) =>
  ({ id: u.id, role: u.role, status: u.status }) as never;

describe("collaboration service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("owner can add a collaborator and they gain list access", async () => {
    const owner = await makeUser("MAIN_BROKER");
    const coBroker = await makeUser("MAIN_BROKER");
    const lead = await makeLead(owner.id, 1);

    const res = await addCollaborator(asSession(owner), { leadId: lead.id, brokerId: coBroker.id });
    expect(res.ok).toBe(true);

    const rows = await listCollaborators(asSession(coBroker), lead.id);
    expect(rows.length).toBe(1);
    expect(rows[0].brokerId).toBe(coBroker.id);
  });

  it("non-owner cannot add collaborators", async () => {
    const owner = await makeUser("MAIN_BROKER");
    const other = await makeUser("MAIN_BROKER");
    const lead = await makeLead(owner.id, 2);

    const res = await addCollaborator(asSession(other), { leadId: lead.id, brokerId: other.id });
    expect(res.ok).toBe(false);
  });

  it("admin can add and remove collaborators", async () => {
    const admin = await makeUser("ADMIN");
    const owner = await makeUser("MAIN_BROKER");
    const coBroker = await makeUser("MAIN_BROKER");
    const lead = await makeLead(owner.id, 3);

    const add = await addCollaborator(asSession(admin), { leadId: lead.id, brokerId: coBroker.id });
    expect(add.ok).toBe(true);

    const rm = await removeCollaborator(asSession(admin), lead.id, coBroker.id);
    expect(rm.ok).toBe(true);
    const rows = await listCollaborators(asSession(admin), lead.id);
    expect(rows.length).toBe(0);
  });

  it("rejects duplicate collaborator and owner-as-collaborator", async () => {
    const owner = await makeUser("MAIN_BROKER");
    const coBroker = await makeUser("MAIN_BROKER");
    const lead = await makeLead(owner.id, 4);

    await addCollaborator(asSession(owner), { leadId: lead.id, brokerId: coBroker.id });
    const dup = await addCollaborator(asSession(owner), { leadId: lead.id, brokerId: coBroker.id });
    expect(dup.ok).toBe(false);

    const self = await addCollaborator(asSession(owner), { leadId: lead.id, brokerId: owner.id });
    expect(self.ok).toBe(false);
  });

  it("unrelated broker cannot list collaborators", async () => {
    const owner = await makeUser("MAIN_BROKER");
    const stranger = await makeUser("MAIN_BROKER");
    const lead = await makeLead(owner.id, 5);
    await expect(listCollaborators(asSession(stranger), lead.id)).rejects.toThrow();
  });
});

describe("reputation pure scoring (integration smoke)", () => {
  it("is importable and deterministic", () => {
    const m = {
      totalLeads: 5,
      convertedLeads: 2,
      totalFollowUps: 3,
      completedFollowUps: 3,
      totalSiteVisits: 1,
      completedSiteVisits: 1,
      paidPayoutAmount: 100_000,
    };
    expect(computeReputationScore(m)).toEqual(computeReputationScore(m));
  });
});
