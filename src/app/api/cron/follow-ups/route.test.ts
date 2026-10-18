import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

function call(auth?: string) {
  return new Request("http://localhost/api/cron/follow-ups", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("cron follow-ups route", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("rejects a forged 'Bearer undefined' when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(call("Bearer undefined"));
    expect(res.status).toBe(401);
  });

  it("rejects a missing authorization header", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const res = await GET(call());
    expect(res.status).toBe(401);
  });

  it("rejects a wrong bearer token", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const res = await GET(call("Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("accepts the correct bearer token", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    const res = await GET(call("Bearer s3cret-value"));
    expect(res.status).toBe(200);
  });
});
