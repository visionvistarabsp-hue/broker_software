# QA Test Plan — Real Estate Referral CRM

Date: 2026-10-16
Scope: Audit of all implemented features, automated tests, critical business workflows, and security controls.
App: Next.js 15 (App Router) + TypeScript + Prisma/PostgreSQL.

## 1. Objectives

1. Inventory every implemented feature and map it to source files and tests.
2. Verify the app can be provisioned and started from a clean database.
3. Execute all automated checks (lint, type-check, unit/integration tests, production build).
4. Exercise critical business workflows (registration, referrals, duplicate handling, lead lifecycle, follow-ups, commissions, CSV, auth).
5. Verify security and access-control behaviour (cross-broker isolation, OTP, sessions, cron, exports).
6. Fix confirmed defects (with regression tests) and re-test.
7. Report honestly what passed, failed, was blocked, or is not implemented.

## 2. Environment & safety

- **The committed `.env` points at a managed cloud PostgreSQL (Neon).** It is treated as
  production-like data and is **never** used for destructive tests. The DB-backed
  integration suites call `deleteMany()` on every table, so they must run against an
  isolated database only.
- An **isolated test database** is used: a throwaway Docker container
  `broker_qa_pg` (`postgres:16`) on `localhost:5544`, database `broker_test`, with
  **synthetic data only**.
- Secrets are never printed. `.env` values were inspected with the password redacted.
- No paid services/dependencies are introduced.

### Test environment setup (reproducible)

```bash
# 1. Isolated Postgres
docker run -d --name broker_qa_pg \
  -e POSTGRES_USER=broker -e POSTGRES_PASSWORD=broker -e POSTGRES_DB=broker_test \
  -p 5544:5432 postgres:16

# 2. Apply migrations (must succeed from scratch)
DATABASE_URL="postgresql://broker:broker@localhost:5544/broker_test?schema=public" \
  npx prisma migrate deploy

# 3. Generate the Prisma client for the local platform
DATABASE_URL="postgresql://broker:broker@localhost:5544/broker_test?schema=public" \
  npx prisma generate

# 4. Run checks
DATABASE_URL="postgresql://broker:broker@localhost:5544/broker_test?schema=public" npx vitest run
npx tsc --noEmit -p tsconfig.json
npx next lint
DATABASE_URL="postgresql://broker:broker@localhost:5544/broker_test?schema=public" npm run build
```

Note: `src/test/setup.ts` forces `NODE_ENV=test` and `OTP_PROVIDER=console` so tests never
contact a real SMTP server.

## 3. Test types

| Type | Tool | Location |
|------|------|----------|
| Unit / integration | Vitest | `src/**/*.test.ts` |
| Static type analysis | `tsc --noEmit` | whole repo |
| Lint | `next lint` (ESLint) | whole repo |
| Production build | `next build` | whole app |
| Smoke (HTTP) | `curl` against `next start` | routes |

There is **no E2E framework** (no Playwright/Cypress config committed; a `.playwright-mcp/`
artifact exists but is not a test suite). E2E is therefore **not implemented**.

## 4. Critical workflows in scope

1. Referral Partner registration + referral submission.
2. Channel Partner registration + property-linked lead creation.
3. Admin property management.
4. Unique code generation (broker/lead/customer/property).
5. Phone normalization.
6. Duplicate referral detection and duplicate-review decisions.
7. Shared phone numbers for distinct customers.
8. Concurrent submissions (same phone).
9. Lead status history / transitions.
10. Follow-up scheduling and notifications (incl. cron).
11. Property matching.
12. Reports and conversion-rate calculations.
13. Commission calculations.
14. CSV import/export.
15. Session expiry and account suspension.
16. Cross-broker access isolation and API authorization.
17. OTP expiry / replay prevention / rate limits.
18. Cron endpoint authentication.

## 5. Exit criteria

- Migrations apply from scratch to a schema identical to `schema.prisma`.
- Lint, type-check and production build pass.
- Vitest suite passes deterministically and serially.
- Every confirmed defect has a fix + regression test, or is documented as open with root cause.
- QA documents produced: this plan, results, bug report, feature audit.
