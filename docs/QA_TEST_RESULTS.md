# QA Test Results — Real Estate Referral CRM

Date: 2026-10-16
Database: isolated local Postgres `broker_test` (container `broker_qa_pg`, port 5544), synthetic data only.
The cloud (Neon) database referenced by the committed `.env` was **not** used for any destructive test.

All results below were produced by actually executing the commands and are copied from the
command output. Nothing here is estimated.

---

## 1. Environment validation

| Check | Command | Result |
|-------|---------|--------|
| Test DB reachable | `docker exec broker_qa_pg pg_isready -U broker -d broker_test` | `accepting connections` |
| Migrations apply from scratch (after BUG-001 fix) | `DATABASE_URL=<test> npx prisma migrate deploy` | **PASS** — 4/4 migrations applied |
| Schema drift | `npx prisma migrate diff --from-url <test> --to-schema-datamodel prisma/schema.prisma` | `No difference detected.` |
| Prisma client generation | `npx prisma generate` | `Generated Prisma Client (v6.19.3)` |
| App starts | `PORT=3100 npx next start` then `curl` | `Ready`; `/login` → **200**, `/` → **200**, `/api/cron/follow-ups` (no auth) → **401** |
| Required env vars present | inspected `.env` with password redacted | all present except `CRON_SECRET` (see BUG-013) |

> Note: `CRON_SECRET` is absent from `.env`/`.env.example`. Its absence enabled the cron
> auth bypass (BUG-013, now fixed); `.env.example` now documents it.

## 2. Static checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | **PASS** (exit 0) |
| Lint | `npx next lint` | **PASS** — "No ESLint warnings or errors" |
| Production build | `DATABASE_URL=<test> npm run build` (`prisma generate && next build`) | **PASS** (exit 0), 24/24 pages generated |

## 3. Automated test suite (Vitest)

Command:
```bash
DATABASE_URL="postgresql://broker:broker@localhost:5544/broker_test?schema=public" npx vitest run
```

### Final result (after fixes)

```
Test Files  22 passed (22)
     Tests  150 passed (150)
   Duration  13.93s
```

- Passed: **150**
- Failed: **0**
- Blocked: **0**
- Skipped: **0**

Test files executed (22):
`src/app/api/cron/follow-ups/route.test.ts`, `src/lib/auth/cookies.test.ts`,
`src/lib/auth/otp.test.ts`, `src/lib/auth/password.test.ts`, `src/lib/auth/session.test.ts`,
`src/lib/authz/authz.test.ts`, `src/lib/env.test.ts`, `src/lib/qr.test.ts`,
`src/lib/services/auth-flow.test.ts`, `src/lib/services/auth-security.test.ts`,
`src/lib/services/brokers.test.ts`, `src/lib/services/codes.test.ts`,
`src/lib/services/collaboration.test.ts`, `src/lib/services/commissions.test.ts`,
`src/lib/services/csv.test.ts`, `src/lib/services/matching.test.ts`,
`src/lib/services/phone.test.ts`, `src/lib/services/referral.test.ts`,
`src/lib/services/registration.test.ts`, `src/lib/services/reputation.test.ts`,
`src/lib/validation/auth.test.ts`, `src/lib/validation/crm.test.ts`.

### Baseline (before fixes) — for comparison

- **Serial** (`--no-file-parallelism`): `Tests 125 passed | 15 failed | 4 skipped`.
- **Parallel** (default): 15–19 failures, **nondeterministic** between runs.

The initial suite could not even start in this environment because the rolldown native
binding and the Prisma engine were Windows-only (BUG-012). After installing the Linux
binding and regenerating the client, the suite ran and exposed BUG-004…BUG-009.

## 4. Critical-workflow coverage (executed)

| Workflow | Covered by | Result |
|----------|-----------|--------|
| Broker registration + OTP + password setup | `registration.test.ts` | PASS |
| Login (phone/email + password) | `auth-flow.test.ts` | PASS |
| OTP single-use / expiry / attempt lockout | `otp.test.ts`, `auth-security.test.ts` | PASS |
| Referral submission via share link | `referral.test.ts` | PASS |
| Duplicate customer/referral detection | `referral.test.ts`, `customers`/`duplicates` services | PASS |
| **Concurrent same-phone submissions** | `referral.test.ts` (new regression) | PASS (one customer) |
| Lead status transitions | `validation/crm.test.ts` | PASS |
| Commission rules / commissions / payouts | `commissions.test.ts` | PASS |
| Commission authz (inaccessible lead denied) | `commissions.test.ts` | PASS |
| CSV parse/serialize + round-trip | `csv.test.ts` | PASS |
| Property matching | `matching.test.ts` | PASS |
| Reputation scoring | `reputation.test.ts`, `collaboration.test.ts` | PASS |
| Session create/validate/rotate/revoke | `session.test.ts` | PASS |
| Suspended account loses access | `auth-security.test.ts`, `brokers.test.ts` | PASS |
| Broker admin list/suspend | `brokers.test.ts` | PASS |
| Phone normalization | `phone.test.ts` | PASS |
| Unique code generation | `codes.test.ts` | PASS |
| Cron endpoint authentication | `route.test.ts` (new) | PASS |

**Not covered by automated tests** (no test executed; reported as unverified):
reporting/conversion-rate page rendering, follow-up scheduling UI, the actual SMTP path,
PWA/offline service worker, security headers (config only), and all browser UI flows (no E2E).

## 5. Security / access-control tests

| Check | Method | Result |
|-------|--------|--------|
| Cross-broker lead access denied | `authz.test.ts` (`canAccessLead`, `scopeLeadWhere`) | PASS |
| Commission access scoped to own/assigned/collaborated leads | `commissions.test.ts` | PASS (after BUG-008 fix) |
| Referral partner cannot access commissions | `commissions.test.ts` | PASS |
| Role escalation blocked (non-admin cannot list brokers) | `brokers.test.ts` | PASS |
| Suspended user's existing session invalidated | `auth-security.test.ts`, `session.ts` | PASS |
| OTP replay prevented / expiry / attempt cap | `otp.test.ts`, `auth-security.test.ts` | PASS |
| Passwords stored as Argon2id (not plaintext) | code review `src/lib/auth/password.ts` | VERIFIED (code) |
| Session tokens stored hashed (SHA-256) | code review `src/lib/auth/session.ts` | VERIFIED (code) |
| Cron endpoint requires secret | `route.test.ts`; live `curl` | PASS (after BUG-013 fix) |
| Secrets not printed to logs | inspected server log for password/otp/token | no secrets observed |
| CSV export authorization (scope by role) | code review `src/lib/services/csv.ts` | VERIFIED (code), **no test** |
| Security headers / CSP | `next.config.ts` | VERIFIED (config), **no test** |

**Live cron bypass evidence (before fix):**
```
no auth:            HTTP 401
Bearer undefined:   HTTP 200  {"ok":true,"created":0}   ← bypass
Bearer wrong:       HTTP 401
```
After the fix (unit test `route.test.ts`): forged/missing/wrong → 401, correct → 200.

## 6. Coverage

No coverage tool is configured (`@vitest/coverage-*` not installed, no `coverage` script).
Coverage was therefore **not measured** and no percentage is reported. Coverage is described
qualitatively in `FEATURE_AUDIT.md` (services are tested; UI/actions and several config-level
features are not).

## 7. Database integrity findings

- Fresh migrations now reproduce the schema exactly (`No difference detected`).
- `Customer.phoneNormalized` is intentionally **not** unique (shared phones allowed);
  duplicate handling is via `DuplicateReview` — consistent with the spec.
- Concurrent same-phone submissions now serialise via an advisory lock (BUG-009).
- Audit writes are best-effort and can be silently dropped (BUG-010); suspensions are not
  audited (BUG-011) — data-integrity/observability gaps.

## 8. Known limitations

- No E2E/browser tests; UI flows unverified automatically.
- Reporting, follow-up UI, PWA and SMTP delivery paths are not machine-verified.
- `CRON_SECRET` is not set in the local env; operators must configure it.
- Rate limiting is in-memory/process-local (documented in `middleware.ts`).
- BUG-003, BUG-010, BUG-011, BUG-012, BUG-014, BUG-015 remain open (see `BUG_REPORT.md`).

## 9. Recommended next actions

1. **BUG-003**: route OTP delivery to the user's email and add an SMTP integration test.
2. Add E2E tests (Playwright) for registration → referral → duplicate review → conversion.
3. Add authorization tests for CSV export and a test for the `setBrokerStatus` audit (BUG-011).
4. Unify code generation on `codes.ts` (BUG-014); stop using `Math.random()`.
5. Make audit failures visible (BUG-010); route service authz through the existing helpers (BUG-015).
6. Standardise the toolchain/lockfile per platform (BUG-012) and add CI running lint + typecheck + tests.
