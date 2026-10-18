import { describe, it, expect } from "vitest";
import { computeReputationScore } from "./reputation";

describe("computeReputationScore", () => {
  const zero = {
    totalLeads: 0,
    convertedLeads: 0,
    totalFollowUps: 0,
    completedFollowUps: 0,
    totalSiteVisits: 0,
    completedSiteVisits: 0,
    paidPayoutAmount: 0,
  };

  it("returns 0 for a broker with no activity", () => {
    const { score, breakdown } = computeReputationScore(zero);
    expect(score).toBe(0);
    expect(breakdown).toEqual({ conversion: 0, followUps: 0, siteVisits: 0, volume: 0, payouts: 0 });
  });

  it("gives full marks for perfect metrics", () => {
    const { score, breakdown } = computeReputationScore({
      totalLeads: 50,
      convertedLeads: 50,
      totalFollowUps: 20,
      completedFollowUps: 20,
      totalSiteVisits: 10,
      completedSiteVisits: 10,
      paidPayoutAmount: 1_000_000,
    });
    expect(breakdown).toEqual({ conversion: 35, followUps: 15, siteVisits: 15, volume: 15, payouts: 20 });
    expect(score).toBe(100);
  });

  it("computes conversion component as 35 * converted/total", () => {
    const { breakdown } = computeReputationScore({ ...zero, totalLeads: 4, convertedLeads: 1 });
    expect(breakdown.conversion).toBe(9); // round(35 * 0.25) = 9
  });

  it("caps volume at 50 leads and payouts at 1,000,000", () => {
    const { breakdown } = computeReputationScore({
      ...zero,
      totalLeads: 500,
      paidPayoutAmount: 5_000_000,
    });
    expect(breakdown.volume).toBe(15);
    expect(breakdown.payouts).toBe(20);
  });

  it("is deterministic for the same metrics", () => {
    const metrics = {
      totalLeads: 10,
      convertedLeads: 3,
      totalFollowUps: 8,
      completedFollowUps: 5,
      totalSiteVisits: 4,
      completedSiteVisits: 2,
      paidPayoutAmount: 250_000,
    };
    expect(computeReputationScore(metrics)).toEqual(computeReputationScore(metrics));
  });

  it("never exceeds 100 or goes below 0", () => {
    const high = computeReputationScore({
      totalLeads: 10_000,
      convertedLeads: 10_000,
      totalFollowUps: 10_000,
      completedFollowUps: 10_000,
      totalSiteVisits: 10_000,
      completedSiteVisits: 10_000,
      paidPayoutAmount: Number.MAX_SAFE_INTEGER,
    });
    expect(high.score).toBe(100);

    // Negative inputs (defensive) clamp to 0 contribution.
    const neg = computeReputationScore({ ...zero, totalLeads: -5, convertedLeads: -2 });
    expect(neg.score).toBeGreaterThanOrEqual(0);
  });
});
