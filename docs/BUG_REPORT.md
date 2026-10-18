# Bug Report — Real Estate Referral CRM

Date: 2026-10-16
Environment: isolated test DB `broker_test` (local Postgres). Production/cloud DB never touched.

Severity: **P0** = data loss / cannot provision; **P1** = broken core feature or security;
**P2** = correctness/quality/observability; **P3** = cosmetic/maintainability.

Summary: **10 fixed**, **5 open**, across the automated run.

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| BUG-001 | P0 | Migrations do not build the schema; `migrate deploy` fails from scratch | Fixed |
| BUG-002 | P1 | Integration tests used the production OTP provider (attempted real SMTP) | Fixed |
| BUG-003 | P1 | SMTP OTP provider sends the code to a **phone string**, not an email | Open |
| BUG-004 | P1 | Commission tests used non-existent actor IDs → FK failures | Fixed |
| BUG-005 | P2 | `stringifyCsv` omitted the trailing CRLF | Fixed |
| BUG-006 | P2 | Referral test asserted a code prefix that the spec/impl do not use | Fixed |
| BUG-007 | P1 | DB integration tests were not isolated → nondeterministic failures | Fixed |
| BUG-008 | P1 | `createCommission` used a `Commission`-shaped scope on a `Lead` query → non-admins always failed | Fixed |
| BUG-009 | P1 | No advisory lock: concurrent submissions created duplicate customers | Fixed |
| BUG-010 | P2 | `writeAudit` swallows every error silently | Open |
| BUG-011 | P2 | `setBrokerStatus` (suspend/deactivate) writes no audit entry | Open |
| BUG-012 | P2 | Lockfile / `node_modules` originated on Windows; Linux needs extra packages | Open |
| BUG-013 | P1 | Cron endpoint auth bypass when `CRON_SECRET` is unset (`Bearer undefined`) | Fixed |
| BUG-014 | P2 | Two conflicting unique-code schemes; CSV import uses insecure `Math.random()` | Open |
| BUG-015 | P3 | Authorization helpers are exported/tested but unused (logic duplicated inline) | Open |

---

## BUG-001 — Migrations do not build the schema (P0) — FIXED

**Reproduction**
```bash
docker exec broker_qa_pg createdb broker_test   # empty DB
DATABASE_URL=".../broker_test" npx prisma migrate deploy
```
**Expected:** all migrations apply and the DB matches `schema.prisma`.
**Actual:** `ERROR: type "ListingType" does not exist` (SQLSTATE 42704). The committed
migration set created only 10 tables / 4 enums, while the schema requires **21 tables /
14 enums**. The `core_crm` migration referenced `Lead`, `Customer`, `ListingType` etc.
that no migration created. (`prisma/migrations/20261016040000_core_crm/migration.sql`.)

**Root cause:** the migration history is incomplete/out of sync with `schema.prisma`; the
dev database had evidently been created with `prisma db push`, leaving a broken migration
baseline.

**Fix:** regenerated `20261016040000_core_crm/migration.sql` from the authoritative schema
using `prisma migrate diff` (base-migrated DB → `schema.prisma`).
**Verification:**
```
$ npx prisma migrate deploy      # 4 migrations, "All migrations have been successfully applied."
$ npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma
No difference detected.
```

---

## BUG-002 — Tests used the production OTP provider (P1) — FIXED

**Reproduction:** run `otp.test.ts` / `registration.test.ts` with the committed `.env`
(`OTP_PROVIDER=smtp`).
**Actual:** `Error: No recipients defined` (nodemailer), tests errored.
**Fix:** `src/test/setup.ts` now forces `NODE_ENV=test` and `OTP_PROVIDER=console` for the
test process (the console provider is hard-blocked in production). No security control was weakened.

## BUG-003 — SMTP OTP is addressed to a phone number (P1) — OPEN

**Reproduction:** configure `OTP_PROVIDER=smtp` and call `issueOtp("+91999...", "LOGIN", userId)`.
**Expected:** the code is emailed to the user's email address.
**Actual:** `SmtpOtpProvider.send(phone, code)` sets `to: phone`; nodemailer fails with
"No recipients defined" because a phone number is not an email address.
**Root cause:** design/implementation mismatch — OTP is conceptually an *email* OTP
(spec §2) but the provider is passed the phone. The user model has an `email` field that is
never used for delivery.
**Recommended fix (needs product decision):** resolve the delivery address (user email via
`userId`, or `PendingRegistration.email`) inside `issueOtp` and pass it to the provider;
require an email for SMTP delivery. Not changed here to avoid altering the auth flow without
a real SMTP integration test.
**Impact:** production OTP login/reset/registration does not deliver.

## BUG-004 — Commission tests used non-existent actors (P1) — FIXED

`commissions.test.ts` passed synthetic actors (`{id:"admin1"}`) to services that write
`createdById`, causing `CommissionRule_createdById_fkey` / `Commission_createdById_fkey`
violations. Fixed by seeding real actor users per test. (The service itself is correct.)

## BUG-005 — CSV serialization omitted trailing CRLF (P2) — FIXED

`stringifyCsv([["a","b"],["1","2"]])` returned `"a,b\r\n1,2"`; the contract/tests expect
`"a,b\r\n1,2\r\n"`. Fixed to append the trailing CRLF (RFC-4180 convention). Round-trip
parsing is unaffected.

## BUG-006 — Referral test asserted a non-existent code prefix (P2) — FIXED

`referral.test.ts` asserted `reference` matches `/^L/`, but `codes.ts` generates
unprefixed 10-char Crockford codes (confirmed by `codes.test.ts` and the design spec §8).
The stale assertion was replaced with `isValidCode(reference)`.

## BUG-007 — Integration tests not isolated (P1) — FIXED

**Reproduction:** run `npx vitest run` (default parallel mode) against one shared DB.
**Actual:** 15–19 failures that varied between runs (`Session_userId_fkey`,
`Customer_createdById_fkey`) because parallel suites deleted rows other suites depended on.
**Fix:** added `src/test/resetDb.ts` (FK-safe truncation) used by the DB suites, and set
`fileParallelism: false` in `vitest.config.ts` for deterministic execution.

## BUG-008 — `createCommission` used the wrong filter shape (P1) — FIXED

**Reproduction:** as a `MAIN_BROKER`, create a commission for a lead you own.
**Expected:** the commission is created.
**Actual:** `PrismaClientValidationError` — because the lead lookup applied
`commissionScope()` (which filters on the `Commission.lead` relation) to a `Lead` query.
Only ADMINs (empty scope) worked; non-admins could **never** create a commission.
**Fix:** new `leadAccessWhere(actor, leadId)` builds a `Lead`-shaped access filter; used in
`createCommission`. **Regression test:** "channel partner can create a commission for their own lead".

## BUG-009 — Concurrent submissions duplicate customers (P1) — FIXED

**Reproduction:** two concurrent `submitReferral`/`submitLead` calls for the same phone.
**Expected:** one customer; the second submission is flagged as a duplicate (spec §5: advisory
lock keyed on normalized phone).
**Actual:** the `existingCustomer` lookup happened outside the transaction, so both calls
created a customer and the duplicate review was skipped.
**Fix:** both flows now take `pg_advisory_xact_lock(hashtext(<phone>))` inside the
transaction before the lookup. **Regression test:** "concurrent submissions for the same
phone create exactly one customer".

## BUG-010 — `writeAudit` swallows all errors (P2) — OPEN

`src/lib/services/audit.ts` wraps the insert in `try { … } catch {}`. FK violations, DB
outages, etc. silently produce no audit row. The intent ("audit must never break the primary
workflow") is reasonable, but failures are completely invisible. **Recommendation:** log the
error (without PII) so missing audit entries are detectable.

## BUG-011 — Suspension/deactivation not audited (P2) — OPEN

`src/lib/services/brokers.ts#setBrokerStatus` updates status and revokes sessions but never
calls `writeAudit`. The design spec requires audit entries for suspensions/reactivations.
**Fix:** add a `writeAudit` call (with a real actor id).

## BUG-012 — Windows-origin dependencies (P2) — OPEN

`package-lock.json` and `node_modules/` were produced on Windows:
`@rolldown/binding-win32-x64-msvc` was the only rolldown native binding present, and the
Prisma client was generated for `windows`. On Linux the test runner failed to start until
`@rolldown/binding-linux-x64-gnu` was installed and `prisma generate` was re-run. **Fix:**
reinstall on each platform (`rm -rf node_modules package-lock.json && npm install`) and/or
commit a lockfile generated in CI; add `binaryTargets = ["native", "debian-openssl-3.0.x"]`
to the Prisma generator if cross-platform artifacts must be portable. (Environment/CI concern.)

## BUG-013 — Cron endpoint auth bypass (P1) — FIXED

**Reproduction**
```bash
curl -H "Authorization: Bearer undefined" http://localhost:3100/api/cron/follow-ups
```
**Expected:** `401`.
**Actual (before fix):** `200 {"ok":true,"created":0}`. Because `CRON_SECRET` is not set in
`.env`, the expected value became the literal `"Bearer undefined"`, which anyone can send.
**Fix:** `route.ts` now rejects when the secret is missing and uses a length-checked
`crypto.timingSafeEqual`. Added `CRON_SECRET` to `.env.example`.
**Regression test:** `src/app/api/cron/follow-ups/route.test.ts` (forged header, missing
header, wrong token, correct token).

## BUG-014 — Two conflicting code schemes (P2) — OPEN

`src/lib/services/codes.ts` generates cryptographically random 10-char Crockford codes and is
used by interactive create flows. `src/lib/services/csv.ts#generateUniqueCodeScoped`
generates `LD-######` / `PR-######` / `CU-######` using `Math.random()` for imported rows.
**Impact:** inconsistent identifiers depending on creation path; `Math.random()` is not
cryptographically secure. **Fix:** have the importer use `codes.generateUniqueCode`.

## BUG-015 — Unused authorization helpers (P3) — OPEN

`canAccessLead`, `scopeLeadWhere`, `assertSameBrokerOrAdmin`, `isActive`
(`src/lib/authz/index.ts`) are unit-tested but never imported by services, which instead
duplicate similar logic inline. **Risk:** drift between the tested policy and the enforced
policy. **Fix:** route service authorization through these helpers.
