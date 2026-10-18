# CSV Import / Export

The broker software supports importing and exporting **leads**, **properties**, and **customers** as CSV files. This document describes the available actions, the CSV format per record kind, authorization rules, and import behavior.

## Entry points

A new **Import/Export** page is available at `/import-export` (also linked from the left-hand navigation for ADMIN, MAIN_BROKER, and REFERRAL_BROKER). The page renders `CsvImportExport` (`src/components/csv-import-export.tsx`) which lets a user:

1. Pick a record kind (Lead / Property / Customer).
2. Export all records in their scope to a `.csv` file.
3. Upload a `.csv`, preview the first rows, and import them.

All actions are server actions (`"use server"`) and require an authenticated session.

## Authorization & data scoping

| Role | Can export | Can import | Records visible |
|------|-----------|------------|-----------------|
| ADMIN | ✅ | ✅ | All records |
| MAIN_BROKER | ✅ | ✅ | Own records only |
| REFERRAL_BROKER | ✅ | ✅ | Own records only |

- Exports apply role-based scoping so a broker never receives another broker's records.
- Imports require one of the three roles above.
- Every export/import writes an audit entry (`writeAudit`) recording the actor, action, target type, and a summary.

## Server actions

Located in `src/lib/actions/csv.ts`, wrapped by `src/lib/services/csv.ts`:

| Action | Kind | Input | Result |
|--------|------|-------|--------|
| `exportLeadsAction` | lead | none | `ActionResult<ExportResult>` |
| `exportPropertiesAction` | property | none | `ActionResult<ExportResult>` |
| `exportCustomersAction` | customer | none | `ActionResult<ExportResult>` |
| `importLeadsAction` | lead | `csvText: string` | `ActionResult<ImportResult>` |
| `importPropertiesAction` | property | `csvText: string` | `ActionResult<ImportResult>` |
| `importCustomersAction` | customer | `csvText: string` | `ActionResult<ImportResult>` |

`ExportResult = { kind, filename, csv, rowCount }` — `csv` is the raw CSV text and `filename` is a suggested download name.

`ImportResult = { kind, totalRows, imported, skipped, ids, errors }` where `errors` is a map of field → message list (see `toFieldErrors`) used to surface row-level validation problems.


## CSV format

Files are plain RFC 4180-flavored CSV (no external dependency; implemented in `src/lib/services/csv.ts`). The first row must be a header. Cells containing commas, quotes, or newlines must be quoted; embedded quotes are doubled.

### Leads (`kind: lead`)

Required columns: `customerName`, `customerPhone`.

| Column | Required | Notes |
|--------|----------|-------|
| customerName | ✅ | |
| customerPhone | ✅ | |
| customerEmail | | |
| customerAddress | | |
| customerCity | | |
| propertyId | | Links the lead to an existing property |
| budgetMin | | Numeric |
| budgetMax | | Numeric |
| preferredLocation | | |
| requirements | | |
| notes | | |
| priority | | One of `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| source | | |
| assignedToId | | Admin only |

Lead import rules:
- The referenced customer is created when it does not exist yet (matched by phone).
- If `propertyId` is given, the property must exist and have status `ACTIVE`; otherwise the row is rejected.
- Each lead receives a unique `LD-######` code.

Example:
```csv
customerName,customerPhone,customerEmail,city,budgetMin,budgetMax,priority,source
"Aanya Sharma","+91 98765 43210","aanya@example.com","Mumbai","8000000","12000000","HIGH","REFERRAL"
```

### Properties (`kind: property`)

Required columns: `title`, `city`, `price`.

| Column | Required | Notes |
|--------|----------|-------|
| title | ✅ | |
| city | ✅ | |
| price | ✅ | Numeric |
| type | | `APARTMENT`, `VILLA`, `HOUSE`, `PLOT`, `COMMERCIAL`, `OFFICE`, `SHOP`, `LAND`, `OTHER` |
| listingType | | `SALE`, `RENT`, `LEASE` |
| address | | |
| locality | | |
| priceMin | | Numeric |
| priceMax | | Numeric |
| area | | Numeric |
| bedrooms | | Numeric |
| bathrooms | | Numeric |
| furnishing | | |
| description | | |
| ownerContact | | |

## Import behavior

- **Max 500 rows** per file. Files with more rows are rejected before any writes.
- All writes for a single import run inside one Prisma transaction (`prisma.$transaction`); on any failure everything rolls back.
- Header names are trimmed and duplicates are made unique (`name`, `name__1`, …).
- Unknown/extra columns are ignored.
- Row-level Zod validation errors are collected and returned per field so the UI can show them inline.
- Unique codes (`LD-`, `PR-`, `CU-`) are generated inside the transaction and checked for collisions (up to 10 attempts).

## Export behavior

- Streams matching records into RFC 4180 CSV text with CRLF line endings.
- Related data is denormalized into the export (e.g. leads include customer name/phone and property title/code).
- Files are named `<kind>-export-<YYYY-MM-DD>.csv`.

## Notes & limitations

- No CSV library is installed; parsing/stringifying is a minimal hand-rolled implementation (`parseCsv`, `stringifyCsv`, `parseCsvWithHeader`) covering quoted fields, embedded commas/newlines, and doubled-quote escaping. It is sufficient for the export/import use cases above but is not a general-purpose RFC 4180 parser.
- Unit tests live in `src/lib/services/csv.test.ts`. They could not be executed in this environment because `node_modules` is missing the `@rolldown/binding-wasm32-wasi` native binding required by vitest (a pre-existing environment issue affecting all vitest suites). Type-checking (`tsc --noEmit`) passes cleanly, including the test file.

## Related files

- `src/lib/validation/csv.ts` — Zod row schemas + `ImportResult`/`ExportResult`/`CsvKind` types
- `src/lib/services/csv.ts` — CSV parser/stringifier + import/export service logic
- `src/lib/actions/csv.ts` — Server action wrappers with authz
- `src/components/csv-import-export.tsx` — Import/Export UI component
- `src/app/(app)/import-export/page.tsx` — Import/Export route
- `src/app/(app)/layout.tsx` — Navigation entry

| status | | `ACTIVE`, `INACTIVE`, `SOLD`, `RENTED`, `ARCHIVED` |

Each property receives a unique `PR-######` code.

Example:
```csv
title,type,listingType,address,city,price,area,bedrooms,bathrooms,status
"3BHK Sea View","APARTMENT","SALE","Marine Drive, Mumbai","Mumbai","25000000","1200","3","3","ACTIVE"
```

### Customers (`kind: customer`)

Required columns: `fullName`, `phone`.

| Column | Required | Notes |
|--------|----------|-------|
| fullName | ✅ | |
| phone | ✅ | |
| email | | |
| address | | |
| city | | |

Customer import rules:
- Customers are matched by normalized phone; an existing customer with the same phone is **skipped** (not duplicated) and counted in `skipped`.
- Each customer receives a unique `CU-######` code.

Example:
```csv
fullName,phone,email,address,city
"Rohan Mehta","+91 98765 12345","rohan@example.com","Bandra West","Mumbai"
```
