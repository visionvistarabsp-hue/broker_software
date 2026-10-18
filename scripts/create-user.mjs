// Create snverse27@gmail.com (Channel Partner) so login works on the live site.
// Registration was never completed on the live site — this finishes it directly.
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function code() {
  let out = "";
  while (out.length < 10)
    for (const b of randomBytes(10)) {
      if (b < 250) {
        out += ALPHABET[b % 32];
        if (out.length === 10) break;
      }
    }
  return out;
}

const EMAIL = "snverse27@gmail.com";
const PASSWORD = "nikhil@123456";
const FULL_NAME = "Nikhil";

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  if (adminEmail && EMAIL.toLowerCase() === adminEmail) {
    console.error(
      `GUARD: ${EMAIL} matches ADMIN_EMAIL. Creating a broker here would shadow the admin account. ` +
        `Change ADMIN_EMAIL or this script's EMAIL.`
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("User already exists:", EMAIL, "status:", existing.status);
    return;
  }

  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      role: "REFERRAL_BROKER",
      status: "PENDING",
      emailVerifiedAt: new Date(),
      consentAt: new Date(),
      passwordHash,
      brokerProfile: {
        create: { brokerCode: code(), fullName: FULL_NAME },
      },
    },
    include: { brokerProfile: true },
  });

  console.log(
    JSON.stringify(
      {
        created: true,
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        brokerCode: user.brokerProfile?.brokerCode,
        fullName: user.brokerProfile?.fullName,
      },
      null,
      2
    )
  );

  // Clean up probe leftovers so they don't confuse future diagnosis.
  const delOtp = await prisma.otpChallenge.deleteMany({ where: { email: EMAIL } });
  const delPending = await prisma.pendingRegistration.deleteMany({ where: { email: EMAIL } });
  console.log("cleaned probe rows:", { otps: delOtp.count, pending: delPending.count });
}

main()
  .catch((e) => {
    console.error("ERROR", e?.message ?? String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
