import { randomBytes } from "node:crypto";

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 10;

export class CodeGenerationError extends Error {
  constructor(message = "Unable to generate a unique code after multiple attempts") {
    super(message);
    this.name = "CodeGenerationError";
  }
}

export function generateCode(): string {
  const alphabetLen = CODE_ALPHABET.length;
  const max = 256 - (256 % alphabetLen);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte < max) {
        out += CODE_ALPHABET[byte % alphabetLen];
        if (out.length === CODE_LENGTH) break;
      }
    }
  }
  return out;
}

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

export async function generateUniqueCode(
  isTaken: (code: string) => Promise<boolean>,
  attempts = 5
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    if (!(await isTaken(code))) return code;
  }
  throw new CodeGenerationError();
}
