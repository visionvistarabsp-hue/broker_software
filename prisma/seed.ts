import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function code() {
  let out = "";
  while (out.length < 10) for (const b of randomBytes(10)) { if (b < 250) { out += ALPHABET[b % 32]; if (out.length === 10) break; } }
  return out;
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      console.error(
        `SEED ERROR: ${email} exists with role ${existing.role}, not ADMIN. ` +
          `Change ADMIN_EMAIL in .env to an unused email and re-run. ` +
          `Do NOT overwrite this user — it belongs to a real account.`
      );
      process.exit(1);
    }
    console.log("Admin already exists:", email);
    return;
  }
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMeStr0ng";
  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  await prisma.user.create({
    data: {
      email,
      role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date(), consentAt: new Date(),
      passwordHash,
      brokerProfile: { create: { brokerCode: code(), fullName: "Administrator" } },
    },
  });
  console.log("Seeded admin:", email, "(set ADMIN_PASSWORD in env to change)");
}

main().finally(() => prisma.$disconnect());
