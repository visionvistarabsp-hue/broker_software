import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = getEnv().SESSION_COOKIE_NAME;

export function buildCookieOptions(expires: Date, nodeEnv: string) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, buildCookieOptions(expiresAt, getEnv().NODE_ENV));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", buildCookieOptions(new Date(0), getEnv().NODE_ENV));
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
