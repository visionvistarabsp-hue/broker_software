import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";
import { createSession, validateSession, revokeSession, rotateSession, revokeAllForUser } from "./session";
import { resetDb } from "@/test/resetDb";

async function makeUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      role: "MAIN_BROKER",
      status: "ACTIVE",
      passwordHash: await hashPassword("Str0ngPassw0rd"),
    },
  });
}

describe("session", () => {
  let userId: string;
  beforeAll(async () => {
    await resetDb();
    const u = await makeUser("session-user@example.com");
    userId = u.id;
  });

  it("creates and validates a session", async () => {
    const { token } = await createSession(userId);
    const res = await validateSession(token);
    expect(res?.user.id).toBe(userId);
    expect(res?.user.role).toBe("MAIN_BROKER");
  });

  it("revokes a session", async () => {
    const { token } = await createSession(userId);
    await revokeSession(token);
    expect(await validateSession(token)).toBeNull();
  });

  it("rotates a session and invalidates the old token", async () => {
    const { token: old } = await createSession(userId);
    const { token: next } = await rotateSession(old);
    expect(await validateSession(old)).toBeNull();
    expect((await validateSession(next))?.user.id).toBe(userId);
  });

  it("revokeAllForUser invalidates every session", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    await revokeAllForUser(userId);
    expect(await validateSession(a.token)).toBeNull();
    expect(await validateSession(b.token)).toBeNull();
  });
});
