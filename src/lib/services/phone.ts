import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function normalizePhone(input: string, defaultRegion: CountryCode = "IN"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

export function maskPhone(e164: string): string {
  if (e164.length <= 6) return "•".repeat(e164.length);
  const head = e164.slice(0, e164.length - 10);
  const tail = e164.slice(-4);
  const dots = "•".repeat(Math.max(0, e164.length - head.length - tail.length));
  return `${head}${dots}${tail}`;
}
