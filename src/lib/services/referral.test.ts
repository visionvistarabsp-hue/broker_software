import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { getPublicBrokerProfile, submitReferral } from "./referral";
import { isValidCode } from "./codes";
import { resetDb } from "@/test/resetDb";

let seq = 0;
function brokerEmail() {
  seq += 1;
  return `broker${seq}@example.com`;
}

async function makeBrokerWithProfile(brokerCode: string) {
  const user = await prisma.user.create({
    data: { email: brokerEmail(), role: "MAIN_BROKER", status: "ACTIVE" },
  });
  await prisma.brokerProfile.create({
    data: { userId: user.id, brokerCode, fullName: "Test Broker", city: "Mumbai", company: "Acme" },
  });
  return user;
}

describe("referral share page", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns public profile without private fields", async () => {
    await makeBrokerWithProfile("BRKAAA0001");
    const profile = await getPublicBrokerProfile("BRKAAA0001");
    expect(profile).not.toBeNull();
    expect(profile!.fullName).toBe("Test Broker");
    expect(profile!.city).toBe("Mumbai");
    // No private fields on the public profile type.
    expect(Object.keys(profile!).sort()).toEqual(["brokerCode", "city", "company", "fullName"]);
  });

  it("returns null for unknown or inactive brokers", async () => {
    expect(await getPublicBrokerProfile("NOPE")).toBeNull();
    const user = await makeBrokerWithProfile("BRKBBB0002");
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    expect(await getPublicBrokerProfile("BRKBBB0002")).toBeNull();
  });

  it("submitReferral creates a lead attributed to the broker", async () => {
    const broker = await makeBrokerWithProfile("BRKCCC0003");
    const res = await submitReferral("BRKCCC0003", {
      customerName: "Ref Person",
      customerPhone: "+91 91234 56789",
      customerEmail: "",
      city: "Pune",
      message: "Looking for 2BHK",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(isValidCode(res.data.reference)).toBe(true);

    const lead = await prisma.lead.findFirst({ where: { submittedById: broker.id, source: "SHARE_LINK" } });
    expect(lead).not.toBeNull();
    expect(lead!.requirements).toBe("Looking for 2BHK");
  });

  it("spam-guards the same phone for the same broker within 24h", async () => {
    await makeBrokerWithProfile("BRKDDD0004");
    const input = { customerName: "A", customerPhone: "+91 90000 11111" };
    const first = await submitReferral("BRKDDD0004", input);
    expect(first.ok).toBe(true);
    const second = await submitReferral("BRKDDD0004", input);
    expect(second.ok).toBe(false);
  });

  it("concurrent submissions for the same phone create exactly one customer", async () => {
    await makeBrokerWithProfile("BRKFFF0006");
    const input = { customerName: "Race Condition", customerPhone: "+91 98888 77777" };
    await Promise.all([
      submitReferral("BRKFFF0006", input),
      submitReferral("BRKFFF0006", input),
    ]);
    const customers = await prisma.customer.findMany({ where: { phoneNormalized: "+919888877777" } });
    expect(customers.length).toBe(1);
  });

  it("rejects invalid phone and unknown broker codes", async () => {
    const bad = await submitReferral("BRKEEE0005", { customerName: "B", customerPhone: "abc" });
    expect(bad.ok).toBe(false);
    const unknown = await submitReferral("UNKNOWN1", { customerName: "C", customerPhone: "+91 91111 22222" });
    expect(unknown.ok).toBe(false);
  });
});
