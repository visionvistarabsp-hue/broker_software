import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: () => {}, get: () => undefined }),
}));

import { canAccessLead, scopeLeadWhere, AuthError, requireRoleOf } from "./index";

const admin = { id: "a1", role: "ADMIN" as const, status: "ACTIVE" as const };
const brokerA = { id: "b1", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const brokerB = { id: "b2", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const referrer = { id: "r1", role: "REFERRAL_BROKER" as const, status: "ACTIVE" as const };

const lead = { id: "L1", submittedById: "b1", assignedToId: null as string | null };

describe("canAccessLead", () => {
  it("admin can access any lead", () => expect(canAccessLead(admin, lead)).toBe(true));
  it("owner broker can access own lead", () => expect(canAccessLead(brokerA, lead)).toBe(true));
  it("other broker cannot access", () => expect(canAccessLead(brokerB, lead)).toBe(false));
  it("assigned broker can access", () =>
    expect(canAccessLead(brokerB, { ...lead, assignedToId: "b2" })).toBe(true));
  it("referral broker cannot access others' lead (owner is a main broker)", () =>
    expect(canAccessLead(referrer, lead)).toBe(false));
  it("referral broker can access own referral", () =>
    expect(canAccessLead(referrer, { ...lead, submittedById: "r1" })).toBe(true));
});

describe("scopeLeadWhere", () => {
  it("admin has no scoping filter", () => expect(scopeLeadWhere(admin)).toEqual({}));
  it("broker scopes to own or assigned", () =>
    expect(scopeLeadWhere(brokerB)).toEqual({ OR: [{ submittedById: "b2" }, { assignedToId: "b2" }] }));
});

describe("requireRoleOf", () => {
  it("allows a listed role", () => expect(requireRoleOf(brokerA, ["MAIN_BROKER"])).toBe(brokerA));
  it("throws 403 for a missing role", () => {
    try {
      requireRoleOf(brokerB, ["ADMIN"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).status).toBe(403);
    }
  });
});
