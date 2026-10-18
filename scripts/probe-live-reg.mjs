// Probe: did the live registration write to THIS (local .env) database?
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "snverse27@gmail.com";

  const users = await prisma.user.count();
  const pending = await prisma.pendingRegistration.findMany({
    where: { email },
    select: { email: true, createdAt: true, expiresAt: true },
  });
  const otps = await prisma.otpChallenge.findMany({
    where: { email, purpose: "REGISTER" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { email: true, purpose: true, createdAt: true, expiresAt: true, attemptCount: true },
  });

  console.log(JSON.stringify({ users, pending, otps }, null, 2));
}

main()
  .catch((e) => {
    console.error("ERROR", e?.message ?? String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
