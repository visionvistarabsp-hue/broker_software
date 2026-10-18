import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    status: true,
    role: true,
    passwordHash: true,
  },
  take: 50,
  orderBy: { createdAt: "asc" },
}).then((rows) =>
  rows.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.status,
    role: u.role,
    hasPassword: Boolean(u.passwordHash),
  }))
);
console.log(JSON.stringify({ count: users.length, users }, null, 2));
await prisma.$disconnect();
