# Backup and Restore

This page documents the backup and restore procedures for the Broker CRM data.

## What is backed up

| Artifact | Where | Frequency |
|---|---|---|
| PostgreSQL schema + rows (all models, incl. commissions, payouts, audit logs) | produce/restore SQL via Prisma | continuous by operator |
| Prisma migrations (`prisma/migrations/`) | checked into git | continuous |
| Seed data | `prisma/seed.ts` → `npm run db:seed` | nightly/ad-hoc |
| File uploads (customer photos, property documents) | object storage attached to the DB cluster | continuous |

## Back up (pull the live database)

**On the deployment machine (or your local machine with the same env vars):**

```bash
# 1. Generate a full SQL dump of the live database
npx prisma db pull ./backup-$(date +%F).sql

# 2. (Optional) copy the file somewhere off-server
cp ./backup-*.sql /path/to/backups/
```

`prisma db pull` writes the full schema + data into an SQL file (it communicates to the database over `DATABASE_URL`). Keep the file outside the database host.

## Restore (replay migrations + seed)

```bash
# 1. Apply the latest migrations on the target database (safe, incremental)
npx prisma migrate deploy

# 2. Apply seed data (admin user, broker profiles, rule cards)
npm run db:seed

# 3. Re-run the application
npm run start
```

> ⚠️ `prisma db push` is NOT a restore tool — it mutates the database to match the schema and can destroy data. Use `migrate deploy` for idempotent restores.

## Recovery from a corrupted row (examples)

- Broken commission/payout rows: run the repair queries in `prisma/repair-commissions.sql` (if present in your operator's toolkit), or re-seed valid rules.
- Audit-records-only fixes: `auditLog` rows are repairable without touching business records (stop the app, patch, restart).

## Test the restore procedure

```bash
# 1. Point a throwaway database at a staging DATABASE_URL
export DATABASE_URL=postgresql://...
# 2. Run the restore steps above against that database
npx prisma migrate deploy
npm run db:seed
# 3. Smoke test with a throwaway app build
npm run build
```

## Retention

Keep at least the last 7 daily dumps outside the database host, and delete dumps older than 30 days. Backup files contain PII — restrict access to them like production credentials.
