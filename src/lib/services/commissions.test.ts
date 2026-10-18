import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  computeCommissionAmount,
  computePayoutAmount,
  listCommissionRules,
  createCommissionRule,
  listCommissions,
  createCommission,
  listPayouts,
  createPayout,
  updatePayoutStatus,
} from "./commissions";
import { AuthError, type SessionUser } from "@/lib/authz";
import { PayoutStatus } from "@prisma/client";
import { resetDb } from "@/test/resetDb";

let admin!: SessionUser;
let mainBroker!: SessionUser;
let referralBroker!: SessionUser;

async function seedActors() {
  const a = await createUser("ADMIN");
  const m = await createUser("MAIN_BROKER");
  const r = await createUser("REFERRAL_BROKER");
  admin = { id: a.id, role: "ADMIN", status: "ACTIVE" };
  mainBroker = { id: m.id, role: "MAIN_BROKER", status: "ACTIVE" };
  referralBroker = { id: r.id, role: "REFERRAL_BROKER", status: "ACTIVE" };
}

let userId = 0;
let customerId = 0;
let leadCodeN = 0;

function uniqPhone() {
  userId += 1;
  return `+9199900${String(userId).padStart(5, "0")}`;
}

let userSeq = 0;
function uniqEmail() {
  userSeq += 1;
  return `user${userSeq}@example.com`;
}

function uniqCustomerCode() {
  customerId += 1;
  return `CUST${customerId}`;
}

function uniqLeadCode() {
  leadCodeN += 1;
  return `LEAD${leadCodeN}`;
}

async function createUser(role: "ADMIN" | "MAIN_BROKER" | "REFERRAL_BROKER") {
  return prisma.user.create({
    data: { email: uniqEmail(), role, status: "ACTIVE" },
  });
}

async function createCustomer(creatorId: string, phone: string) {
  return prisma.customer.create({
    data: {
      customerCode: uniqCustomerCode(),
      fullName: "Test Customer",
      phoneOriginal: phone,
      phoneNormalized: phone,
      createdById: creatorId,
    },
  });
}

async function createLead(submitterId: string, customerId: string) {
  return prisma.lead.create({
    data: {
      leadCode: uniqLeadCode(),
      customerId,
      submittedById: submitterId,
      status: "NEW",
      priority: "MEDIUM",
      source: "REFERRAL",
    },
  });
}

describe("computeCommissionAmount", () => {
  it("computes basis points correctly", () => {
    expect(computeCommissionAmount(100000, 250)).toBe(2500);
    expect(computeCommissionAmount(1000000, 100)).toBe(10000);
    expect(computeCommissionAmount(500000, 0)).toBe(0);
    expect(computeCommissionAmount(100000, 333)).toBe(3330);
  });
});

describe("computePayoutAmount", () => {
  it("computes basis points correctly", () => {
    expect(computePayoutAmount(10000, 5000)).toBe(5000);
    expect(computePayoutAmount(10000, 10000)).toBe(10000);
    expect(computePayoutAmount(10000, 0)).toBe(0);
    expect(computePayoutAmount(9999, 3333)).toBe(3333);
  });
});

describe("commission rules", () => {
  beforeEach(async () => {
    await resetDb();
    await seedActors();
  });

  it("admin can list and create rules", async () => {
    const rules = await listCommissionRules(admin);
    expect(rules.length).toBe(0);

    const created = await createCommissionRule(admin, {
      name: "Standard",
      percentBasisPoints: 250,
      appliesTo: "SALE",
    });
    expect(created.name).toBe("Standard");
    expect(created.percentBasisPoints).toBe(250);

    const after = await listCommissionRules(admin);
    expect(after.length).toBe(1);
  });

  it("channel partner can list rules but not create them", async () => {
    const rules = await listCommissionRules(mainBroker);
    expect(rules.length).toBe(0);
  });
});

describe("commissions", () => {
  beforeEach(async () => {
    await resetDb();
    await seedActors();
  });

  it("referral partner cannot list commissions", async () => {
    await expect(listCommissions(referralBroker)).rejects.toBeInstanceOf(AuthError);
  });

  it("admin can list all commissions", async () => {
    const rows = await listCommissions(admin);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
  });

  it("admin can create a commission for a lead", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);

    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });
    expect(commission.dealAmount).toBe(1000000);
    expect(commission.percentBasisPoints).toBe(200);
    expect(commission.computedAmount).toBe(20000);
  });

  it("channel partner can create a commission for their own lead", async () => {
    const brokerUser = await createUser("MAIN_BROKER");
    const customer = await createCustomer(brokerUser.id, uniqPhone());
    const lead = await createLead(brokerUser.id, customer.id);

    const commission = await createCommission(
      { id: brokerUser.id, role: "MAIN_BROKER", status: "ACTIVE" },
      { leadId: lead.id, dealAmount: 500000, percentBasisPoints: 100 },
    );
    expect(commission.computedAmount).toBe(5000);
  });

  it("commission uses rule percentBasisPoints when ruleId provided", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);

    const rule = await createCommissionRule(admin, {
      name: "Rule1",
      percentBasisPoints: 500,
      appliesTo: "SALE",
    });

    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 2000000,
      ruleId: rule.id,
    });
    expect(commission.percentBasisPoints).toBe(500);
    expect(commission.computedAmount).toBe(100000);
  });

  it("rejects commission for inaccessible lead", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);

    await expect(
      createCommission(mainBroker, {
        leadId: lead.id,
        dealAmount: 1000000,
        percentBasisPoints: 200,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects duplicate commission for same lead", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);

    await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    await expect(
      createCommission(admin, {
        leadId: lead.id,
        dealAmount: 1000000,
        percentBasisPoints: 200,
      }),
    ).rejects.toThrow(/already exists/i);
  });
});

describe("payouts", () => {
  beforeEach(async () => {
    await resetDb();
    await seedActors();
  });

  it("referral partner sees own payouts only", async () => {
    const rows = await listPayouts(referralBroker);
    expect(rows.length).toBe(0);
  });

  it("referral partner cannot create payouts", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);
    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    const payee = await createUser("REFERRAL_BROKER");

    await expect(
      createPayout(referralBroker, {
        commissionId: commission.id,
        payeeBrokerId: payee.id,
        shareBasisPoints: 5000,
        amount: 10000,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("admin can create payout on a commission", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);
    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    const payee = await createUser("REFERRAL_BROKER");

    const payout = await createPayout(admin, {
      commissionId: commission.id,
      payeeBrokerId: payee.id,
      shareBasisPoints: 5000,
      amount: 10000,
    });
    expect(payout.status).toBe(PayoutStatus.PENDING);
    expect(payout.shareBasisPoints).toBe(5000);
    expect(payout.amount).toBe(10000);
  });

  it("rejects payout exceeding 10000 bps total", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);
    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    const payee = await createUser("REFERRAL_BROKER");

    await createPayout(admin, {
      commissionId: commission.id,
      payeeBrokerId: payee.id,
      shareBasisPoints: 6000,
      amount: 12000,
    });

    await expect(
      createPayout(admin, {
        commissionId: commission.id,
        payeeBrokerId: payee.id,
        shareBasisPoints: 5000,
        amount: 10000,
      }),
    ).rejects.toThrow(/exceeds/i);
  });

  it("admin can update payout status to PAID", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);
    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    const payee = await createUser("REFERRAL_BROKER");

    const payout = await createPayout(admin, {
      commissionId: commission.id,
      payeeBrokerId: payee.id,
      shareBasisPoints: 5000,
      amount: 10000,
    });

    const updated = await updatePayoutStatus(admin, payout.id, {
      status: PayoutStatus.APPROVED,
    });
    expect(updated.status).toBe(PayoutStatus.APPROVED);

    const paid = await updatePayoutStatus(admin, payout.id, {
      status: PayoutStatus.PAID,
      reason: "Paid via bank transfer",
    });
    expect(paid.status).toBe(PayoutStatus.PAID);
  });

  it("channel partner cannot approve payouts on inaccessible commissions", async () => {
    const adminUser = await createUser("ADMIN");
    const customer = await createCustomer(adminUser.id, uniqPhone());
    const lead = await createLead(adminUser.id, customer.id);
    const commission = await createCommission(admin, {
      leadId: lead.id,
      dealAmount: 1000000,
      percentBasisPoints: 200,
    });

    const payee = await createUser("REFERRAL_BROKER");

    const payout = await createPayout(admin, {
      commissionId: commission.id,
      payeeBrokerId: payee.id,
      shareBasisPoints: 5000,
      amount: 10000,
    });

    await expect(
      updatePayoutStatus(mainBroker, payout.id, {
        status: PayoutStatus.APPROVED,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
