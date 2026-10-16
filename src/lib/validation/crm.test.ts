import { describe, it, expect } from "vitest";
import { isValidLeadTransition, leadCreateSchema } from "@/lib/validation/crm";
import { propertySchema } from "@/lib/validation/property";

describe("lead transitions", () => {
  it("allows NEW -> CONTACTED", () => {
    expect(isValidLeadTransition("NEW", "CONTACTED")).toBe(true);
  });

  it("rejects NEW -> CONVERTED", () => {
    expect(isValidLeadTransition("NEW", "CONVERTED")).toBe(false);
  });

  it("allows NEGOTIATION -> CONVERTED", () => {
    expect(isValidLeadTransition("NEGOTIATION", "CONVERTED")).toBe(true);
  });

  it("allows LOST -> NEW (reopen)", () => {
    expect(isValidLeadTransition("LOST", "NEW")).toBe(true);
  });

  it("rejects CONVERTED -> anything", () => {
    expect(isValidLeadTransition("CONVERTED", "NEW")).toBe(false);
  });
});

describe("lead create schema", () => {
  it("rejects bad budget range", () => {
    const res = leadCreateSchema.safeParse({
      customerName: "Ravi Kumar",
      customerPhone: "+919876543210",
      budgetMin: 5000000,
      budgetMax: 1000000,
    });
    expect(res.success).toBe(false);
  });

  it("requires a valid phone", () => {
    const res = leadCreateSchema.safeParse({ customerName: "Ravi", customerPhone: "123" });
    expect(res.success).toBe(false);
  });
});

describe("property schema", () => {
  it("rejects negative price", () => {
    const res = propertySchema.safeParse({ title: "2BHK Flat", city: "Pune", price: -100 });
    expect(res.success).toBe(false);
  });

  it("requires city and title", () => {
    const res = propertySchema.safeParse({ title: "A", city: "", price: 1000000 });
    expect(res.success).toBe(false);
  });
});
