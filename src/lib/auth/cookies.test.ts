import { describe, it, expect } from "vitest";
import { buildCookieOptions } from "./cookies";

describe("buildCookieOptions", () => {
  it("is httpOnly, lax, root path, secure only in production", () => {
    const dev = buildCookieOptions(new Date(Date.now() + 1000), "development");
    expect(dev).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
    const prod = buildCookieOptions(new Date(Date.now() + 1000), "production");
    expect(prod.secure).toBe(true);
  });
});
