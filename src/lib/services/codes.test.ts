import { describe, it, expect, vi } from "vitest";
import { generateCode, isValidCode, generateUniqueCode, CODE_ALPHABET } from "./codes";

describe("codes", () => {
  it("generates a 10-char valid code", () => {
    const c = generateCode();
    expect(c).toHaveLength(10);
    expect(isValidCode(c)).toBe(true);
  });

  it("uses only unambiguous alphabet characters", () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 200; i++) {
      for (const ch of generateCode()) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("retries on collision then succeeds", async () => {
    const isTaken = vi
      .fn<(code: string) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const code = await generateUniqueCode(isTaken);
    expect(isValidCode(code)).toBe(true);
    expect(isTaken).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting attempts", async () => {
    await expect(generateUniqueCode(async () => true, 3)).rejects.toThrow(/unique/i);
  });
});
