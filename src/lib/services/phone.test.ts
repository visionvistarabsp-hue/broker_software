import { describe, it, expect } from "vitest";
import { normalizePhone, maskPhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes an Indian number with no country code", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
  });
  it("normalizes an Indian number with +91", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
  });
  it("keeps a valid non-Indian number", () => {
    expect(normalizePhone("+1 415 555 0132")).toBe("+14155550132");
  });
  it("returns null for garbage", () => {
    expect(normalizePhone("not-a-phone")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("masks the middle digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91••••••3210");
  });
  it("masks short inputs", () => {
    expect(maskPhone("12345678")).toBe("••••5678");
  });
});
