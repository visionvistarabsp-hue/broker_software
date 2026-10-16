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
  const phone = process.env.ADMIN_PHONE ?? "+919999999999";
  const existing = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (existing) {
    console.log("Admin already exists:", phone);
    return;
  }
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMeStr0ng";
  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  await prisma.user.create({
    data: {
      phoneOriginal: phone, phoneNormalized: phone,
      email: process.env.ADMIN_EMAIL ?? "admin@example.com",
      role: "ADMIN", status: "ACTIVE", phoneVerifiedAt: new Date(), consentAt: new Date(),
      passwordHash,
      brokerProfile: { create: { brokerCode: code(), fullName: "Administrator" } },
    },
  });
  console.log("Seeded admin:", phone, "(set ADMIN_PASSWORD in env to change)");
}

main().finally(() => prisma.$disconnect());
