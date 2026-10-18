import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { generateDueReminders } from "@/lib/services/followups";

export const dynamic = "force-dynamic";

function isAuthorized(header: string | null, secret: string | undefined): boolean {
  // Never allow the endpoint to run when no secret is configured. Without
  // this guard the expected value would become the literal "Bearer undefined",
  // letting anyone forge the header.
  if (!secret) return false;
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!isAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { created } = await generateDueReminders();
  return NextResponse.json({ ok: true, created });
}
