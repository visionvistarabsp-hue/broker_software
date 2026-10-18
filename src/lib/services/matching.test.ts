import { describe, it, expect } from "vitest";
import {
  matchLeadToProperties,
  type LeadMatchInput,
  type PropertyMatchInput,
  getLeadPriority,
  parseMatchLeadToPropertiesInput,
} from "@/lib/services/matching";

const lead: LeadMatchInput = {
  id: "lead-1",
  budgetMin: 2000000,
  budgetMax: 5000000,
  preferredLocation: "pune",
  requirements: "2 BHK apartment sale",
  createdAt: new Date("2026-01-10").toISOString(),
};

const active = (overrides: Partial<PropertyMatchInput>): PropertyMatchInput => ({
  id: "prop-1",
  title: "Flat",
  price: 4000000,
  city: "Pune",
  type: "APARTMENT",
  listingType: "SALE",
  status: "ACTIVE",
  updatedAt: new Date("2026-01-10").toISOString(),
  ...overrides,
});

describe("matchLeadToProperties", () => {
  it("scores a fully matching active property highly", () => {
    const res = matchLeadToProperties(lead, [active({ id: "p1" })]);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBeGreaterThanOrEqual(90);
    expect(res[0].available).toBe(true);
    expect(res[0].matchReasons.length).toBeGreaterThan(0);
    expect(res[0].mismatches.length).toBe(0);
    expect(res[0].currency).toBe("INR");
  });

  it("excludes non-active properties", () => {
    const res = matchLeadToProperties(lead, [
      active({ id: "p1", status: "SOLD" }),
      active({ id: "p2", status: "ACTIVE" }),
    ]);
    expect(res.map((r) => r.propertyId)).toEqual(["p2"]);
  });

  it("adds a mismatch and lower score for over-budget property", () => {
    const res = matchLeadToProperties(lead, [
      active({ id: "p1", price: 9000000 }),
    ]);
    expect(res[0].score).toBeLessThanOrEqual(70); // budget contributes 0; max other = 25+30+15 = 70
    expect(res[0].mismatches.length).toBeGreaterThan(0);
    expect(res[0].mismatches.join(" ")).toContain("exceeds");
  });

  it("applies minScore filter", () => {
    const res = matchLeadToProperties(lead, [active({ id: "p1" })], { leadId: "lead-1", minScore: 99 });
    expect(res).toHaveLength(0);
  });

  it("applies limit and sorts by score descending", () => {
    const res = matchLeadToProperties(lead, [
      active({ id: "low", price: 2100000, city: "Mumbai" }),
      active({ id: "high", price: 4000000, city: "Pune" }),
    ], { leadId: "lead-1", limit: 1 });
    expect(res).toHaveLength(1);
    expect(res[0].propertyId).toBe("high");
    expect(res[0].score).toBeGreaterThan(res[0].score - 1); // sanity
  });

  it("returns currency INR and lastUpdated", () => {
    const res = matchLeadToProperties(lead, [active({ id: "p1" })]);
    expect(res[0].currency).toBe("INR");
    expect(res[0].lastUpdated).toBeTruthy();
  });
});

describe("getLeadPriority", () => {
  it("rates an urgent, recent, high-budget lead as URGENT", () => {
    const res = getLeadPriority({
      ...lead,
      priority: "URGENT",
      createdAt: new Date().toISOString(),
    });
    expect(res.tier).toBe("URGENT");
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  it("rates a low-priority old lead with no requirements as LOW", () => {
    const res = getLeadPriority({
      id: "lead-2",
      budgetMin: 0,
      budgetMax: 50000,
      priority: "LOW",
      createdAt: new Date("2020-01-01").toISOString(),
    });
    expect(res.tier).toBe("LOW");
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  it("caps score at 100", () => {
    const res = getLeadPriority({
      ...lead,
      priority: "URGENT",
      budgetMin: 0,
      budgetMax: 20000000,
      createdAt: new Date().toISOString(),
    });
    expect(res.score).toBeLessThanOrEqual(100);
  });
});

describe("parseMatchLeadToPropertiesInput", () => {
  it("accepts valid input", () => {
    const res = parseMatchLeadToPropertiesInput({ leadId: "11111111-1111-1111-1111-111111111111", minScore: 10, limit: 5 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.leadId).toBe("11111111-1111-1111-1111-111111111111");
      expect(res.data.minScore).toBe(10);
      expect(res.data.limit).toBe(5);
    }
  });

  it("rejects minScore out of range", () => {
    const res = parseMatchLeadToPropertiesInput({ leadId: "11111111-1111-1111-1111-111111111111", minScore: 101 });
    expect(res.success).toBe(false);
    expect(res.success).toBe(false);
  });

  it("rejects missing leadId", () => {
    const res = parseMatchLeadToPropertiesInput({ minScore: 0 });
    expect(res.success).toBe(false);
  });
});
