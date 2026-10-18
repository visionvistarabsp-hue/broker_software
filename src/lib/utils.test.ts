import { describe, expect, it } from "vitest";
import { roleLabel } from "@/lib/utils";

describe("roleLabel", () => {
  it("uses the current partner names for broker roles", () => {
    expect(roleLabel("MAIN_BROKER")).toBe("Channel Partner");
    expect(roleLabel("REFERRAL_BROKER")).toBe("Referral Partner");
  });

  it("keeps the admin label", () => {
    expect(roleLabel("ADMIN")).toBe("Admin");
  });
});
