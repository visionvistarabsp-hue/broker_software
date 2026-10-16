import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, assertPasswordPolicy } from "./password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("Str0ngPassw0rd");
    expect(hash).not.toContain("Str0ngPassw0rd");
    expect(await verifyPassword(hash, "Str0ngPassw0rd")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("enforces policy", () => {
    expect(() => assertPasswordPolicy("short1")).toThrow();
    expect(() => assertPasswordPolicy("alllettersonly")).toThrow();
    expect(() => assertPasswordPolicy("Str0ngPassw0rd")).not.toThrow();
  });
});
