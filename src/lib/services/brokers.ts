import { prisma } from "@/lib/db";
import { requireRoleOf, AuthError, type SessionUser } from "@/lib/authz";
import { revoke } from "@/lib/authz/helpers";
import type { UserStatus } from "@prisma/client";

export async function listBrokers(actor: SessionUser) {
  requireRoleOf(actor, ["ADMIN"]);
  return prisma.user.findMany({
    where: { role: { in: ["MAIN_BROKER", "REFERRAL_BROKER"] } },
    include: { brokerProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function setBrokerStatus(
  actor: SessionUser,
  userId: string,
  status: UserStatus
): Promise<void> {
  requireRoleOf(actor, ["ADMIN"]);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === "ADMIN") throw new AuthError(400, "Invalid target account");
  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED" || status === "DEACTIVATED") {
    await revoke(userId);
  }
}
