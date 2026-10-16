import { hash, verify, type Algorithm } from "@node-rs/argon2";

const ARGON2ID = 2 as Algorithm;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function assertPasswordPolicy(plain: string): void {
  if (plain.length < 10) throw new Error("Password must be at least 10 characters.");
  if (!/[A-Za-z]/.test(plain)) throw new Error("Password must contain a letter.");
  if (!/[0-9]/.test(plain)) throw new Error("Password must contain a digit.");
}

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain, { algorithm: ARGON2ID });
  } catch {
    return false;
  }
}
