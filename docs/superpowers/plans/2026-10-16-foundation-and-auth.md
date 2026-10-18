# Foundation & Auth/RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Prisma + PostgreSQL foundation and a working, server-enforced authentication and role-based access system for the Real Estate Referral CRM.

**Architecture:** Single Next.js App Router app (Node runtime). Domain logic lives in `src/lib/services`; auth primitives in `src/lib/auth`; authorization guards in `src/lib/authz`. All server mutations validate with Zod and go through an authorization guard. PostgreSQL via Prisma. Tests with Vitest against a real Postgres (Docker locally).

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3, shadcn/ui, Prisma 6, PostgreSQL 16, Zod, `@node-rs/argon2`, `libphonenumber-js`, `nodemailer`, date-fns, Vitest.

## Global Constraints

- Node 24; npm as package manager.
- TypeScript `strict: true`; no `any` in committed code except where Prisma requires a cast and it is commented.
- Locale: default country `+91` (India), currency `INR`, area unit `sq.ft.` — these defaults are used verbatim where relevant.
- No production code path may require a paid API or premium library. Dev OTP provider must be impossible to activate when `NODE_ENV=production`.
- Passwords hashed with Argon2id only. Never store or log plaintext passwords, OTP codes, or session tokens.
- Every server action / route handler begins with an authorization guard from `src/lib/authz`.
- Test claims are only made when tests were actually executed.
- Commit after every task with a conventional-commit message.

---

### Task 1: Project scaffolding and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs`, `.nvmrc`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `docker-compose.yml`
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `.gitignore` (already present)

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`. Ports: app `3000`, Postgres `5432`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "broker-software",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install next@15 react@19 react-dom@19 zod@3 @prisma/client@6 \
  @node-rs/argon2 libphonenumber-js date-fns nodemailer class-variance-authority \
  clsx tailwind-merge lucide-react
npm install -D typescript @types/node @types/react @types/react-dom @types/nodemailer \
  tailwindcss@3 postcss autoprefixer prisma@6 vitest @vitejs/plugin-react \
  tsx eslint eslint-config-next dotenv
```
Expected: install completes; `node_modules` present.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.nvmrc`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};
export default config;
```

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`eslint.config.mjs`:
```js
import next from "eslint-config-next";
export default [...next()];
```

`.nvmrc`:
```
24
```

- [ ] **Step 5: Create base app files**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Broker CRM",
  description: "Real estate referral and lead management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function HomePage() {
  return <main className="p-8">Broker CRM</main>;
}
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: broker
      POSTGRES_PASSWORD: broker
      POSTGRES_DB: broker
    ports:
      - "5432:5432"
    volumes:
      - broker_pgdata:/var/lib/postgresql/data
volumes:
  broker_pgdata:
```

- [ ] **Step 7: Create `vitest.config.ts` and `src/test/setup.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

`src/test/setup.ts`:
```ts
import "dotenv/config";
```

- [ ] **Step 8: Verify build and tooling**

Run: `docker compose up -d && npm run typecheck && npm run lint`
Expected: container `db` healthy; typecheck and lint pass with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js, Tailwind, Prisma deps, Vitest, docker Postgres"
```

---

### Task 2: shadcn/ui base components

**Files:**
- Create: `src/lib/utils.ts`, `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `alert.tsx`
- Modify: `tailwind.config.ts` (add design tokens)

**Interfaces:**
- Produces: `cn(...inputs)` from `src/lib/utils.ts`; UI primitives `Button`, `Input`, `Label`, `Card` (+ `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`), `Badge`, `Alert`.

- [ ] **Step 1: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Add design tokens to `tailwind.config.ts`**

Replace the `theme.extend` block with:
```ts
theme: {
  extend: {
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
      destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
    },
    borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
  },
},
```

- [ ] **Step 3: Add CSS variables to `src/app/globals.css`**

Append:
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 222 47% 11%;
    --primary: 222 47% 11%;
    --primary-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 4: Create UI primitives**

`src/components/ui/button.tsx`:
```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  )
);
Button.displayName = "Button";
export { buttonVariants };
```

`src/components/ui/input.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

`src/components/ui/label.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
  )
);
Label.displayName = "Label";
```

`src/components/ui/card.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-background shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...p} />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold", className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...p} />
);
```

`src/components/ui/badge.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", className)}
      {...p}
    />
  );
}
```

`src/components/ui/alert.tsx`:
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn("rounded-md border p-3 text-sm", className)} {...p} />;
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add base shadcn-style primitives and design tokens"
```

---

### Task 3: Prisma schema, migration, and DB client

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `.env`, `.env.example`
- Modify: `package.json` (prisma seed config)

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton) from `src/lib/db.ts`. Models `User`, `BrokerProfile`, `Session`, `OtpChallenge` with enums `Role`, `UserStatus`, `OtpPurpose`.

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MAIN_BROKER
  REFERRAL_BROKER
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum OtpPurpose {
  REGISTER
  LOGIN
  RESET
}

model User {
  id              String        @id @default(cuid())
  email           String?       @unique
  phoneOriginal   String
  phoneNormalized String        @unique
  passwordHash    String?
  role            Role
  status          UserStatus    @default(PENDING)
  phoneVerifiedAt DateTime?
  emailVerifiedAt DateTime?
  consentAt       DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  brokerProfile  BrokerProfile?
  sessions       Session[]
  otpChallenges  OtpChallenge[]

  @@index([role, status])
}

model BrokerProfile {
  id         String   @id @default(cuid())
  userId     String   @unique
  brokerCode String   @unique
  fullName   String
  city       String?
  company    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Session {
  id            String   @id @default(cuid())
  userId        String
  tokenHash     String   @unique
  expiresAt     DateTime
  revokedAt     DateTime?
  rotatedFromId String?
  ip            String?
  userAgent     String?
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model OtpChallenge {
  id           String     @id @default(cuid())
  userId       String?
  phone        String
  purpose      OtpPurpose
  codeHash     String
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int        @default(0)
  createdAt    DateTime   @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([phone, purpose])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Create `.env` (dev only, gitignored) and `.env.example`**

`.env`:
```
DATABASE_URL="postgresql://broker:broker@localhost:5432/broker?schema=public"
APP_URL="http://localhost:3000"
SESSION_COOKIE_NAME="broker_session"
SESSION_TTL_HOURS="720"
OTP_TTL_MINUTES="10"
OTP_MAX_ATTEMPTS="5"
OTP_PROVIDER="console"
SMTP_URL=""
SMTP_FROM="no-reply@example.com"
DEV_OTP_CODE=""
```

`.env.example` — identical but with placeholder DATABASE_URL and no real secrets:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
APP_URL="http://localhost:3000"
SESSION_COOKIE_NAME="broker_session"
SESSION_TTL_HOURS="720"
OTP_TTL_MINUTES="10"
OTP_MAX_ATTEMPTS="5"
# "console" (development only) or "smtp"
OTP_PROVIDER="console"
SMTP_URL=""
SMTP_FROM="no-reply@example.com"
# Optional: force a fixed OTP during local development only. Never set in production.
DEV_OTP_CODE=""
```

- [ ] **Step 3: Add seed config to `package.json`**

Add a top-level key:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```
And create `prisma/seed.ts`:
```ts
console.log("seed: no-op (populated in later tasks)");
```

- [ ] **Step 4: Run the initial migration**

Run: `npx prisma migrate dev --name init`
Expected: Prisma creates `prisma/migrations/*_init/migration.sql`, applies it to the Docker Postgres, and generates the client.

- [ ] **Step 5: Create `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Verify**

Run: `npx prisma validate && npm run typecheck`
Expected: schema valid; typecheck passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): add Prisma schema, init migration, and client singleton"
```

---

### Task 4: Environment validation module

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `env` object typed with all vars; throws on invalid/missing config. `env.OTP_PROVIDER` is `"console" | "smtp"`. Also exports `assertOtpProviderUsable()` which throws if provider is `console` in production.

- [ ] **Step 1: Write the failing test**

`src/lib/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  APP_URL: "http://localhost:3000",
  SESSION_COOKIE_NAME: "broker_session",
  SESSION_TTL_HOURS: "720",
  OTP_TTL_MINUTES: "10",
  OTP_MAX_ATTEMPTS: "5",
  OTP_PROVIDER: "console",
  SMTP_URL: "",
  SMTP_FROM: "no-reply@example.com",
};

describe("parseEnv", () => {
  it("parses valid env", () => {
    const e = parseEnv(base as NodeJS.ProcessEnv);
    expect(e.SESSION_TTL_HOURS).toBe(720);
    expect(e.OTP_PROVIDER).toBe("console");
  });

  it("rejects console OTP provider in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
      /OTP_PROVIDER/
    );
  });

  it("rejects invalid OTP_PROVIDER", () => {
    expect(() => parseEnv({ ...base, OTP_PROVIDER: "sms" } as NodeJS.ProcessEnv)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/env.test.ts`
Expected: FAIL — `parseEnv` is not exported / module not found.

- [ ] **Step 3: Implement `src/lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url(),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce.number().int().positive(),
  OTP_TTL_MINUTES: z.coerce.number().int().positive(),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive(),
  OTP_PROVIDER: z.enum(["console", "smtp"]),
  SMTP_URL: z.string().default(""),
  SMTP_FROM: z.string().default("no-reply@example.com"),
  DEV_OTP_CODE: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.parse(source);
  if (parsed.NODE_ENV === "production" && parsed.OTP_PROVIDER === "console") {
    throw new Error("OTP_PROVIDER=console is not allowed in production; configure SMTP.");
  }
  if (parsed.NODE_ENV === "production" && parsed.OTP_PROVIDER === "smtp" && !parsed.SMTP_URL) {
    throw new Error("OTP_PROVIDER=smtp requires SMTP_URL in production.");
  }
  return parsed;
}

let cached: Env | undefined;
export function getEnv(): Env {
  if (!cached) cached = parseEnv();
  return cached;
}
export const env = getEnv();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(config): add validated environment module with OTP provider guard"
```

---

### Task 5: Identification code generator

**Files:**
- Create: `src/lib/services/codes.ts`
- Test: `src/lib/services/codes.test.ts`

**Interfaces:**
- Produces: `generateCode(): string` (10 chars, Crockford base32 unambiguous alphabet), `isValidCode(s: string): boolean`, and `generateUniqueCode(isTaken: (code: string) => Promise<boolean>, attempts = 5): Promise<string>` which retries and throws `CodeGenerationError` on exhaustion.

- [ ] **Step 1: Write the failing test**

`src/lib/services/codes.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateCode, isValidCode, generateUniqueCode, CODE_ALPHABET } from "./codes";

describe("codes", () => {
  it("generates a 10-char valid code", () => {
    const c = generateCode();
    expect(c).toHaveLength(10);
    expect(isValidCode(c)).toBe(true);
  });

  it("uses only unambiguous alphabet characters", () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 200; i++) {
      for (const ch of generateCode()) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("retries on collision then succeeds", async () => {
    const isTaken = vi
      .fn<[string], Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const code = await generateUniqueCode(isTaken);
    expect(isValidCode(code)).toBe(true);
    expect(isTaken).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting attempts", async () => {
    await expect(generateUniqueCode(async () => true, 3)).rejects.toThrow(/unique/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services/codes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/services/codes.ts`**

```ts
import { randomBytes } from "node:crypto";

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 10;

export class CodeGenerationError extends Error {
  constructor(message = "Unable to generate a unique code after multiple attempts") {
    super(message);
    this.name = "CodeGenerationError";
  }
}

export function generateCode(): string {
  const alphabetLen = CODE_ALPHABET.length;
  const max = 256 - (256 % alphabetLen);
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte < max) {
        out += CODE_ALPHABET[byte % alphabetLen];
        if (out.length === CODE_LENGTH) break;
      }
    }
  }
  return out;
}

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

export async function generateUniqueCode(
  isTaken: (code: string) => Promise<boolean>,
  attempts = 5
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    if (!(await isTaken(code))) return code;
  }
  throw new CodeGenerationError();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services/codes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(services): add secure unambiguous 10-char code generator with collision retry"
```

---

### Task 6: Phone number normalization

**Files:**
- Create: `src/lib/services/phone.ts`
- Test: `src/lib/services/phone.test.ts`

**Interfaces:**
- Produces: `normalizePhone(input: string, defaultRegion = "IN"): string | null` returning E.164 or null when unparseable. `maskPhone(e164: string): string` returning a display-safe form.

- [ ] **Step 1: Write the failing test**

`src/lib/services/phone.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, maskPhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes an Indian number with no country code", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
  });
  it("normalizes an Indian number with +91", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
  });
  it("keeps a valid non-Indian number", () => {
    expect(normalizePhone("+1 415 555 0132")).toBe("+14155550132");
  });
  it("returns null for garbage", () => {
    expect(normalizePhone("not-a-phone")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("masks the middle digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91••••••3210");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services/phone.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/services/phone.ts`**

```ts
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function normalizePhone(input: string, defaultRegion: CountryCode = "IN"): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

export function maskPhone(e164: string): string {
  if (e164.length <= 6) return "•".repeat(e164.length);
  const head = e164.slice(0, e164.length - 10);
  const tail = e164.slice(-4);
  const dots = "•".repeat(Math.max(0, e164.length - head.length - tail.length));
  return `${head}${dots}${tail}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services/phone.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(services): add E.164 phone normalization (IN default) and masking"
```

---

### Task 7: Password hashing (Argon2id)

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `src/lib/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`, `assertPasswordPolicy(plain: string): void` (min 10 chars, at least one letter and one digit).

- [ ] **Step 1: Write the failing test**

`src/lib/auth/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, assertPasswordPolicy } from "./password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("Str0ngPassw0rd");
    expect(hash).not.toContain("Str0ngPassw0rd");
    expect(await verifyPassword(hash, "Str0ngPassw0rd")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("enforces policy", () => {
    expect(() => assertPasswordPolicy("short1")).toThrow();
    expect(() => assertPasswordPolicy("alllettersonly")).toThrow();
    expect(() => assertPasswordPolicy("Str0ngPassw0rd")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth/password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/password.ts`**

```ts
import { hash, verify, Algorithm } from "@node-rs/argon2";

const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function assertPasswordPolicy(plain: string): void {
  if (plain.length < 10) throw new Error("Password must be at least 10 characters.");
  if (!/[A-Za-z]/.test(plain)) throw new Error("Password must contain a letter.");
  if (!/[0-9]/.test(plain)) throw new Error("Password must contain a digit.");
}

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain, { algorithm: Algorithm.Argon2id });
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth/password.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add Argon2id password hashing and policy"
```

---

### Task 8: Session service

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`

**Interfaces:**
- Produces: `createSession(userId, meta?): Promise<{ token: string; expiresAt: Date }>`, `validateSession(token): Promise<{ user: SessionUser } | null>`, `revokeSession(token): Promise<void>`, `revokeAllForUser(userId): Promise<void>`, `rotateSession(oldToken, meta?): Promise<{ token: string; expiresAt: Date }>`. Exposes `hashToken(token)` (sha256 hex). `SessionUser = { id, role, status }`.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/session.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "./password";
import { createSession, validateSession, revokeSession, rotateSession, revokeAllForUser } from "./session";

async function makeUser(phone: string) {
  return prisma.user.create({
    data: {
      phoneOriginal: phone,
      phoneNormalized: phone,
      role: "MAIN_BROKER",
      status: "ACTIVE",
      passwordHash: await hashPassword("Str0ngPassw0rd"),
    },
  });
}

describe("session", () => {
  let userId: string;
  beforeAll(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany({ where: { phoneNormalized: { startsWith: "+91999" } } });
    const u = await makeUser("+919990000001");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/session.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { Role, UserStatus } from "@prisma/client";

export interface SessionUser {
  id: string;
  role: Role;
  status: UserStatus;
}

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function expiryFromNow(): Date {
  const hours = getEnv().SESSION_TTL_HOURS;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function createSession(userId: string, meta: SessionMeta = {}) {
  const token = newToken();
  const expiresAt = expiryFromNow();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<{ user: SessionUser } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  const { user } = session;
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") return null;
  return { user: { id: user.id, role: user.role, status: user.status } };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateSession(oldToken: string, meta: SessionMeta = {}) {
  const old = await prisma.session.findUnique({ where: { tokenHash: hashToken(oldToken) } });
  if (!old || old.revokedAt || old.expiresAt.getTime() < Date.now()) {
    throw new Error("Cannot rotate an invalid session");
  }
  const token = newToken();
  const expiresAt = expiryFromNow();
  await prisma.$transaction([
    prisma.session.update({ where: { id: old.id }, data: { revokedAt: new Date() } }),
    prisma.session.create({
      data: {
        userId: old.userId,
        tokenHash: hashToken(token),
        expiresAt,
        rotatedFromId: old.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);
  return { token, expiresAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth/session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add server-side session service with rotation and revocation"
```

---

### Task 9: OTP challenge service and provider abstraction

**Files:**
- Create: `src/lib/auth/otp.ts`, `src/lib/auth/otp-provider.ts`
- Test: `src/lib/auth/otp.test.ts`

**Interfaces:**
- Consumes: `prisma`, `getEnv`.
- Produces: `issueOtp(phone, purpose, userId?): Promise<void>` (hashes a 6-digit code, stores challenge, dispatches via provider); `verifyOtp(phone, purpose, code): Promise<{ ok: true } | { ok: false; reason: "invalid" | "expired" | "attempts" }>` consuming single-use; `OtpProvider` interface with `send(phone, code)`. `getOtpProvider()` returns console (dev-only) or SMTP.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/otp.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { issueOtp, verifyOtp, generateOtpCode, hashOtpCode } from "./otp";

const PHONE = "+919990000002";

describe("otp", () => {
  beforeAll(async () => {
    await prisma.otpChallenge.deleteMany({ where: { phone: { startsWith: "+91999" } } });
  });

  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("issues and verifies a code once (single use)", async () => {
    const code = "123456";
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "REGISTER",
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(await verifyOtp(PHONE, "REGISTER", code)).toEqual({ ok: true });
    expect(await verifyOtp(PHONE, "REGISTER", code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired code", async () => {
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "LOGIN",
        codeHash: hashOtpCode("654321"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await verifyOtp(PHONE, "LOGIN", "654321")).toEqual({ ok: false, reason: "expired" });
  });

  it("locks out after too many attempts", async () => {
    await prisma.otpChallenge.create({
      data: {
        phone: PHONE,
        purpose: "RESET",
        codeHash: hashOtpCode("111111"),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    for (let i = 0; i < 5; i++) await verifyOtp(PHONE, "RESET", "000000");
    expect(await verifyOtp(PHONE, "RESET", "111111")).toEqual({ ok: false, reason: "attempts" });
  });

  it("issueOtp stores a hashed challenge", async () => {
    process.env.DEV_OTP_CODE = "";
    await issueOtp(PHONE, "REGISTER");
    const row = await prisma.otpChallenge.findFirst({ where: { phone: PHONE, purpose: "REGISTER" } });
    expect(row).toBeTruthy();
    expect(row!.codeHash).not.toMatch(/\d{6}/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth/otp.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/otp-provider.ts`**

```ts
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export interface OtpProvider {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}

class ConsoleOtpProvider implements OtpProvider {
  readonly name = "console";
  async send(phone: string, code: string): Promise<void> {
    if (getEnv().NODE_ENV === "production") {
      throw new Error("Console OTP provider must never run in production.");
    }
    console.log(`[DEV OTP] ${phone} -> ${code}`);
  }
}

class SmtpOtpProvider implements OtpProvider {
  readonly name = "smtp";
  async send(phone: string, code: string): Promise<void> {
    const env = getEnv();
    if (!env.SMTP_URL) throw new Error("SMTP is not configured (SMTP_URL missing).");
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: phone,
      subject: "Your verification code",
      text: `Your verification code is ${code}. It expires soon. Do not share it.`,
    });
  }
}

export function getOtpProvider(): OtpProvider {
  const env = getEnv();
  if (env.NODE_ENV === "production" || env.OTP_PROVIDER === "smtp") {
    return new SmtpOtpProvider();
  }
  return new ConsoleOtpProvider();
}
```

- [ ] **Step 4: Implement `src/lib/auth/otp.ts`**

```ts
import { createHash, randomInt } from "node:crypto";
import type { OtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getOtpProvider } from "./otp-provider";

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function issueOtp(phone: string, purpose: OtpPurpose, userId?: string): Promise<void> {
  const env = getEnv();
  const code = env.DEV_OTP_CODE && env.NODE_ENV !== "production" ? env.DEV_OTP_CODE : generateOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otpChallenge.create({
    data: { phone, purpose, userId, codeHash: hashOtpCode(code), expiresAt },
  });
  await getOtpProvider().send(phone, code);
}

export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "attempts" };

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<VerifyResult> {
  const env = getEnv();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "invalid" };
  if (challenge.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (challenge.attemptCount >= env.OTP_MAX_ATTEMPTS) return { ok: false, reason: "attempts" };

  if (challenge.codeHash !== hashOtpCode(code)) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    return updated.attemptCount >= env.OTP_MAX_ATTEMPTS
      ? { ok: false, reason: "attempts" }
      : { ok: false, reason: "invalid" };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/auth/otp.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): add OTP challenge service and pluggable email/console provider"
```

---

### Task 10: Cookie session helpers

**Files:**
- Create: `src/lib/auth/cookies.ts`
- Test: `src/lib/auth/cookies.test.ts`

**Interfaces:**
- Produces: `SESSION_COOKIE` name from env; `setSessionCookie(token, expiresAt): Promise<void>`, `clearSessionCookie(): Promise<void>`, `readSessionToken(): Promise<string | null>` using `next/headers` cookies with `httpOnly`, `secure` (production), `sameSite: "lax"`, `path: "/"`.

- [ ] **Step 1: Write the failing test**

Because `next/headers` is not available in Vitest, test the pure option builder instead.

`src/lib/auth/cookies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCookieOptions } from "./cookies";

describe("buildCookieOptions", () => {
  it("is httpOnly, lax, root path, secure only in production", () => {
    const dev = buildCookieOptions(new Date(Date.now() + 1000), "development");
    expect(dev).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
    const prod = buildCookieOptions(new Date(Date.now() + 1000), "production");
    expect(prod.secure).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth/cookies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/cookies.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth/cookies.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add secure httpOnly session cookie helpers"
```

---

### Task 11: Authorization guards (RBAC)

**Files:**
- Create: `src/lib/authz/index.ts`
- Test: `src/lib/authz/authz.test.ts`

**Interfaces:**
- Consumes: `readSessionToken`, `validateSession`, `prisma`.
- Produces: `getCurrentUser(): Promise<SessionUser | null>`; `requireUser(): Promise<SessionUser>` (throws `AuthError`); `requireRole(...roles: Role[]): Promise<SessionUser>`; `assertSameBrokerOrAdmin(actor, ownerId)`; `AuthError` with `status` 401/403. Pure helpers `canAccessLead(actor, lead)` and `scopeLeadWhere(actor)` are unit-tested without a DB.

- [ ] **Step 1: Write the failing test**

`src/lib/authz/authz.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canAccessLead, scopeLeadWhere, AuthError, requireRoleOf } from "./index";

const admin = { id: "a1", role: "ADMIN" as const, status: "ACTIVE" as const };
const brokerA = { id: "b1", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const brokerB = { id: "b2", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const referrer = { id: "r1", role: "REFERRAL_BROKER" as const, status: "ACTIVE" as const };

const lead = { id: "L1", submittedById: "b1", assignedToId: null as string | null };

describe("canAccessLead", () => {
  it("admin can access any lead", () => expect(canAccessLead(admin, lead)).toBe(true));
  it("owner broker can access own lead", () => expect(canAccessLead(brokerA, lead)).toBe(true));
  it("other broker cannot access", () => expect(canAccessLead(brokerB, lead)).toBe(false));
  it("assigned broker can access", () =>
    expect(canAccessLead(brokerB, { ...lead, assignedToId: "b2" })).toBe(true));
  it("referral partner cannot access others' lead (owner is a channel partner)", () =>
    expect(canAccessLead(referrer, lead)).toBe(false));
  it("referral partner can access own referral", () =>
    expect(canAccessLead(referrer, { ...lead, submittedById: "r1" })).toBe(true));
});

describe("scopeLeadWhere", () => {
  it("admin has no scoping filter", () => expect(scopeLeadWhere(admin)).toEqual({}));
  it("broker scopes to own or assigned", () =>
    expect(scopeLeadWhere(brokerB)).toEqual({ OR: [{ submittedById: "b2" }, { assignedToId: "b2" }] }));
});

describe("requireRoleOf", () => {
  it("allows a listed role", () => expect(requireRoleOf(brokerA, ["MAIN_BROKER"])).toBe(brokerA));
  it("throws 403 for a missing role", () => {
    try {
      requireRoleOf(brokerB, ["ADMIN"]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).status).toBe(403);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/authz/authz.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/authz/index.ts`**

```ts
import type { Role, UserStatus } from "@prisma/client";
import { readSessionToken } from "@/lib/auth/cookies";
import { validateSession, type SessionUser } from "@/lib/auth/session";

export type { SessionUser };

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

interface LeadScope {
  id: string;
  submittedById: string;
  assignedToId: string | null;
}

export function requireRoleOf(user: SessionUser, roles: Role[]): SessionUser {
  if (!roles.includes(user.role)) throw new AuthError(403, "Forbidden");
  return user;
}

export function canAccessLead(user: SessionUser, lead: LeadScope): boolean {
  if (user.role === "ADMIN") return true;
  return lead.submittedById === user.id || lead.assignedToId === user.id;
}

export function scopeLeadWhere(user: SessionUser): Record<string, unknown> {
  if (user.role === "ADMIN") return {};
  return { OR: [{ submittedById: user.id }, { assignedToId: user.id }] };
}

export function assertSameBrokerOrAdmin(user: SessionUser, ownerId: string | null): void {
  if (user.role === "ADMIN") return;
  if (ownerId === user.id) return;
  throw new AuthError(403, "Forbidden");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const result = await validateSession(token);
  return result?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Authentication required");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  return requireRoleOf(user, roles);
}

export function isActive(status: UserStatus): boolean {
  return status === "ACTIVE";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/authz/authz.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(authz): add RBAC guards and lead-scope helpers"
```

---

### Task 12: Shared validation schemas and form error helper

**Files:**
- Create: `src/lib/validation/auth.ts`, `src/lib/validation/common.ts`
- Test: `src/lib/validation/auth.test.ts`

**Interfaces:**
- Produces: `registerSchema`, `verifyOtpSchema`, `setPasswordSchema`, `loginSchema`, `otpLoginRequestSchema`, `resetRequestSchema`, `resetConfirmSchema`; `normalizedPhoneField`; `actionError(message)` / `actionSuccess(data?)` result helpers sharing `ActionResult<T>`.

- [ ] **Step 1: Write the failing test**

`src/lib/validation/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { registerSchema, setPasswordSchema, loginSchema } from "./auth";

describe("validation", () => {
  it("registerSchema normalizes phone and requires consent", () => {
    const r = registerSchema.safeParse({
      fullName: "Asha Rao",
      phone: "+91 98765 43210",
      role: "REFERRAL_BROKER",
      consent: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("+919876543210");
  });

  it("registerSchema rejects missing consent", () => {
    const r = registerSchema.safeParse({ fullName: "A", phone: "9876543210", role: "MAIN_BROKER", consent: false });
    expect(r.success).toBe(false);
  });

  it("setPasswordSchema enforces policy", () => {
    expect(setPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: "Str0ngPassw0rd", confirm: "Str0ngPassw0rd" }).success).toBe(true);
  });

  it("loginSchema accepts identifier + password", () => {
    expect(loginSchema.safeParse({ identifier: "919876543210", password: "Str0ngPassw0rd" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/validation/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/validation/common.ts`**

```ts
import { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionError(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
```

- [ ] **Step 4: Implement `src/lib/validation/auth.ts`**

```ts
import { z } from "zod";
import { normalizePhone } from "@/lib/services/phone";

const phoneField = z
  .string()
  .min(1, "Phone number is required")
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: phoneField,
  email: z.union([z.string().email(), z.literal("")]).optional(),
  role: z.enum(["MAIN_BROKER", "REFERRAL_BROKER"]),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(["REGISTER", "LOGIN", "RESET"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  role: z.enum(["MAIN_BROKER", "REFERRAL_BROKER"]).optional(),
  fullName: z.string().optional(),
});

export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "At least 10 characters"),
    confirm: z.string().min(1),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((d) => /[A-Za-z]/.test(d.password) && /[0-9]/.test(d.password), {
    path: ["password"],
    message: "Include a letter and a digit",
  });

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

export const otpLoginRequestSchema = z.object({ phone: phoneField });

export const resetRequestSchema = z.object({ phone: phoneField });

export const resetConfirmSchema = setPasswordSchema.omit({ token: true }).extend({
  phone: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/validation/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(validation): add shared auth Zod schemas and ActionResult helpers"
```

---

### Task 13: Registration service + OTP verification + password setup

**Files:**
- Create: `src/lib/services/registration.ts`, `src/lib/services/pending-registration.ts`
- Test: `src/lib/services/registration.test.ts`

**Interfaces:**
- Consumes: `prisma`, `generateUniqueCode`, `issueOtp`, `verifyOtp`, `hashPassword`, `revokeAllForUser`.
- Produces: `startRegistration(input: RegisterInput): Promise<ActionResult<{ phone: string }>>`; `completeRegistration(input: VerifyOtpInput): Promise<ActionResult<{ userId: string }>>` (verifies OTP, creates User PENDING + BrokerProfile with unique brokerCode); `finalizePassword(userId, password): Promise<ActionResult<{ token: string; expiresAt: Date }>>`.
- Note: OTP is issued before the User row exists, so `startRegistration` stores pending details in an in-memory signed map keyed by phone is NOT durable across serverless invocations. Instead, store pending registration fields inside a dedicated `PendingRegistration` table (added to schema in this task).

- [ ] **Step 1: Add `PendingRegistration` model**

Append to `prisma/schema.prisma`:
```prisma
model PendingRegistration {
  id          String   @id @default(cuid())
  phone       String   @unique
  fullName    String
  email       String?
  role        Role
  consentAt   DateTime
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([expiresAt])
}
```
Run: `npx prisma migrate dev --name pending_registration`
Expected: migration applied and client regenerated.

- [ ] **Step 2: Write the failing test**

`src/lib/services/registration.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/lib/auth/otp";
import { startRegistration, completeRegistration, finalizePassword } from "./registration";

const PHONE = "+919990000003";

describe("registration", () => {
  beforeEach(async () => {
    await prisma.pendingRegistration.deleteMany({ where: { phone: PHONE } });
    await prisma.otpChallenge.deleteMany({ where: { phone: PHONE } });
    await prisma.brokerProfile.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
    await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  });

  it("starts registration and stores pending row", async () => {
    process.env.DEV_OTP_CODE = "222333";
    const res = await startRegistration({
      fullName: "Asha Rao", phone: PHONE, role: "REFERRAL_BROKER", consent: true, email: "",
    });
    expect(res.ok).toBe(true);
    const pending = await prisma.pendingRegistration.findUnique({ where: { phone: PHONE } });
    expect(pending?.role).toBe("REFERRAL_BROKER");
  });

  it("completes registration with valid OTP and assigns a broker code", async () => {
    await prisma.pendingRegistration.create({
      data: { phone: PHONE, fullName: "Asha Rao", role: "REFERRAL_BROKER", consentAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "REGISTER", codeHash: hashOtpCode("222333"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeRegistration({ phone: PHONE, purpose: "REGISTER", code: "222333" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const user = await prisma.user.findUnique({ where: { id: res.data.userId }, include: { brokerProfile: true } });
    expect(user?.status).toBe("PENDING");
    expect(user?.brokerProfile?.brokerCode).toHaveLength(10);
    expect(await prisma.pendingRegistration.findUnique({ where: { phone: PHONE } })).toBeNull();
  });

  it("rejects an invalid OTP", async () => {
    await prisma.pendingRegistration.create({
      data: { phone: PHONE, fullName: "Asha Rao", role: "REFERRAL_BROKER", consentAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "REGISTER", codeHash: hashOtpCode("222333"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeRegistration({ phone: PHONE, purpose: "REGISTER", code: "999999" });
    expect(res.ok).toBe(false);
  });

  it("finalizes password and returns a session", async () => {
    const u = await prisma.user.create({
      data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "REFERRAL_BROKER", status: "PENDING" },
    });
    const res = await finalizePassword(u.id, "Str0ngPassw0rd");
    expect(res.ok).toBe(true);
    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.passwordHash).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/services/registration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/services/registration.ts`**

```ts
import { prisma } from "@/lib/db";
import { generateUniqueCode } from "@/lib/services/codes";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllForUser, createSession } from "@/lib/auth/session";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";
import type { RegisterInput } from "@/lib/validation/auth";
import type { OtpPurpose } from "@prisma/client";

const PENDING_TTL_MS = 30 * 60 * 1000;

export async function startRegistration(input: RegisterInput): Promise<ActionResult<{ phone: string }>> {
  const existing = await prisma.user.findUnique({ where: { phoneNormalized: input.phone } });
  if (existing) return actionError("An account with this phone number already exists.");
  await prisma.pendingRegistration.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      fullName: input.fullName,
      email: input.email || null,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
    update: {
      fullName: input.fullName,
      email: input.email || null,
      role: input.role,
      consentAt: new Date(),
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  try {
    await issueOtp(input.phone, "REGISTER");
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Unable to send verification code.");
  }
  return actionSuccess({ phone: input.phone });
}

export interface CompleteRegistrationInput {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}

export async function completeRegistration(
  input: CompleteRegistrationInput
): Promise<ActionResult<{ userId: string }>> {
  const pending = await prisma.pendingRegistration.findUnique({ where: { phone: input.phone } });
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    return actionError("Your registration session expired. Please start again.");
  }
  const result = await verifyOtp(input.phone, input.purpose, input.code);
  if (!result.ok) return actionError("Invalid or expired verification code.");

  const existing = await prisma.user.findUnique({ where: { phoneNormalized: input.phone } });
  if (existing) return actionError("An account with this phone number already exists.");

  const user = await prisma.$transaction(async (tx) => {
    const code = await generateUniqueCode(async (c) =>
      !!(await tx.brokerProfile.findUnique({ where: { brokerCode: c } }))
    );
    const created = await tx.user.create({
      data: {
        phoneOriginal: input.phone,
        phoneNormalized: input.phone,
        email: pending.email,
        role: pending.role,
        status: "PENDING",
        phoneVerifiedAt: new Date(),
        consentAt: pending.consentAt,
      },
    });
    await tx.brokerProfile.create({
      data: { userId: created.id, brokerCode: code, fullName: pending.fullName },
    });
    await tx.pendingRegistration.delete({ where: { phone: input.phone } });
    return created;
  });

  return actionSuccess({ userId: user.id });
}

export async function finalizePassword(
  userId: string,
  password: string
): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllForUser(userId);
  const session = await createSession(userId);
  return actionSuccess(session);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/services/registration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): add registration flow with pending store, OTP verification, broker code"
```

---

### Task 14: Login, OTP login, logout, and password reset services

**Files:**
- Create: `src/lib/services/auth-flow.ts`
- Test: `src/lib/services/auth-flow.test.ts`

**Interfaces:**
- Produces: `loginWithPassword(input): Promise<ActionResult<{ token; expiresAt }>>` (accepts email or phone as identifier; rejects non-ACTIVE accounts with a clear message; rotates legacy sessions); `requestLoginOtp(phone): Promise<ActionResult<{ phone }>>`; `completeLoginOtp(phone, code): Promise<ActionResult<{ token; expiresAt }>>`; `logout(token): Promise<void>`; `requestPasswordReset(phone)`; `resetPassword(phone, code, newPassword)` (revokes all sessions after change).

- [ ] **Step 1: Write the failing test**

`src/lib/services/auth-flow.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashOtpCode } from "@/lib/auth/otp";
import { loginWithPassword, completeLoginOtp, resetPassword } from "./auth-flow";

const PHONE = "+919990000004";

async function seedUser(status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  return prisma.user.create({
    data: {
      phoneOriginal: PHONE, phoneNormalized: PHONE, email: "u4@example.com",
      role: "MAIN_BROKER", status, passwordHash: await hashPassword("Str0ngPassw0rd"),
    },
  });
}

describe("auth-flow", () => {
  beforeEach(async () => { await prisma.session.deleteMany(); await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } }); });

  it("logs in with phone + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: PHONE, password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("logs in with email + password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: "u4@example.com", password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(true);
  });

  it("rejects wrong password", async () => {
    await seedUser();
    const res = await loginWithPassword({ identifier: PHONE, password: "nope" });
    expect(res.ok).toBe(false);
  });

  it("rejects suspended accounts", async () => {
    await seedUser("SUSPENDED");
    const res = await loginWithPassword({ identifier: PHONE, password: "Str0ngPassw0rd" });
    expect(res.ok).toBe(false);
  });

  it("completes OTP login for an active user", async () => {
    await seedUser();
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "LOGIN", codeHash: hashOtpCode("445566"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await completeLoginOtp(PHONE, "445566");
    expect(res.ok).toBe(true);
  });

  it("resets password and revokes sessions", async () => {
    const u = await seedUser();
    const s = await prisma.session.create({ data: { userId: u.id, tokenHash: "t1", expiresAt: new Date(Date.now() + 1e6) } });
    await prisma.otpChallenge.create({
      data: { phone: PHONE, purpose: "RESET", codeHash: hashOtpCode("778899"), expiresAt: new Date(Date.now() + 60000) },
    });
    const res = await resetPassword(PHONE, "778899", "NewStr0ngPass");
    expect(res.ok).toBe(true);
    const after = await prisma.session.findUnique({ where: { id: s.id } });
    expect(after?.revokedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services/auth-flow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/services/auth-flow.ts`**

```ts
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, revokeAllForUser, revokeSession } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/services/phone";
import { actionError, actionSuccess, type ActionResult } from "@/lib/validation/common";

type SessionPayload = { token: string; expiresAt: Date };

async function findUserByIdentifier(identifier: string) {
  const asPhone = normalizePhone(identifier);
  return prisma.user.findFirst({
    where: asPhone ? { phoneNormalized: asPhone } : { email: identifier.toLowerCase() },
    include: { brokerProfile: true },
  });
}

export async function loginWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<ActionResult<SessionPayload>> {
  const user = await findUserByIdentifier(input.identifier.trim());
  if (!user || !user.passwordHash) return actionError("Invalid credentials.");
  if (user.status === "SUSPENDED") return actionError("Your account is suspended. Contact an admin.");
  if (user.status === "DEACTIVATED") return actionError("Your account is deactivated.");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) return actionError("Invalid credentials.");
  await revokeAllForUser(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id);
  return actionSuccess(session);
}

export async function requestLoginOtp(phone: string): Promise<ActionResult<{ phone: string }>> {
  const user = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (!user) return actionError("No account found for this phone number.");
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    return actionError("This account cannot log in. Contact an admin.");
  }
  try {
    await issueOtp(phone, "LOGIN", user.id);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Unable to send code.");
  }
  return actionSuccess({ phone });
}

export async function completeLoginOtp(phone: string, code: string): Promise<ActionResult<SessionPayload>> {
  const user = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (!user) return actionError("No account found for this phone number.");
  if (user.status !== "ACTIVE") return actionError("This account cannot log in yet.");
  const result = await verifyOtp(phone, "LOGIN", code);
  if (!result.ok) return actionError("Invalid or expired code.");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id);
  return actionSuccess(session);
}

export async function logout(token: string): Promise<void> {
  await revokeSession(token);
}

export async function requestPasswordReset(phone: string): Promise<ActionResult<{ phone: string }>> {
  const user = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (user) {
    try {
      await issueOtp(phone, "RESET", user.id);
    } catch (e) {
      return actionError(e instanceof Error ? e.message : "Unable to send code.");
    }
  }
  return actionSuccess({ phone });
}

export async function resetPassword(
  phone: string,
  code: string,
  newPassword: string
): Promise<ActionResult<{ ok: true }>> {
  const user = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (!user) return actionError("Invalid request.");
  const result = await verifyOtp(phone, "RESET", code);
  if (!result.ok) return actionError("Invalid or expired code.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await revokeAllForUser(user.id);
  return actionSuccess({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services/auth-flow.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): add password/OTP login, logout, and password reset flows"
```

---

### Task 15: Auth server actions and pages

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/verify/page.tsx`, `src/app/(auth)/set-password/page.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`
- Create: `src/lib/actions/auth.ts`
- Create: `src/components/forms/*` (client components calling the actions)

**Interfaces:**
- Consumes: all services from Tasks 13–14, cookie helpers from Task 10.
- Produces: server actions `registerAction`, `verifyOtpAction`, `setPasswordAction`, `loginAction`, `otpLoginAction`, `logoutAction`, `resetRequestAction`, `resetConfirmAction`. Each returns `ActionResult` and sets/clears cookies on success.

- [ ] **Step 1: Implement `src/lib/actions/auth.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { registerSchema, verifyOtpSchema, setPasswordSchema, loginSchema, resetConfirmSchema } from "@/lib/validation/auth";
import { zodFieldErrors, actionError, type ActionResult } from "@/lib/validation/common";
import { startRegistration, completeRegistration, finalizePassword } from "@/lib/services/registration";
import {
  loginWithPassword, completeLoginOtp, logout, requestLoginOtp, requestPasswordReset, resetPassword,
} from "@/lib/services/auth-flow";
import { setSessionCookie, clearSessionCookie, readSessionToken } from "@/lib/auth/cookies";

export async function registerAction(formData: FormData): Promise<ActionResult<{ phone: string }>> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    role: formData.get("role"),
    consent: formData.get("consent") === "on" || formData.get("consent") === "true",
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  return startRegistration(parsed.data);
}

export async function verifyOtpAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    purpose: "REGISTER",
    code: formData.get("code"),
  });
  if (!parsed.success) return actionError("Invalid code.", zodFieldErrors(parsed.error));
  return completeRegistration({ phone: parsed.data.phone, purpose: "REGISTER", code: parsed.data.code });
}

export async function setPasswordAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const userId = String(formData.get("userId") ?? "");
  const parsed = setPasswordSchema.safeParse({
    token: userId,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  const res = await finalizePassword(userId, parsed.data.password);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function loginAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return actionError("Enter your credentials.", zodFieldErrors(parsed.error));
  const res = await loginWithPassword(parsed.data);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function otpLoginAction(formData: FormData): Promise<ActionResult<{ phone: string }>> {
  const { normalizePhone } = await import("@/lib/services/phone");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return actionError("Enter a valid phone number.");
  return requestLoginOtp(phone);
}

export async function completeOtpLoginAction(phone: string, code: string): Promise<ActionResult<{ ok: true }>> {
  const res = await completeLoginOtp(phone, code);
  if (!res.ok) return res;
  await setSessionCookie(res.data.token, res.data.expiresAt);
  return { ok: true, data: { ok: true } };
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function resetRequestAction(formData: FormData): Promise<ActionResult<{ phone: string }>> {
  const { normalizePhone } = await import("@/lib/services/phone");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return actionError("Enter a valid phone number.");
  return requestPasswordReset(phone);
}

export async function resetConfirmAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = resetConfirmSchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return actionError("Please fix the errors below.", zodFieldErrors(parsed.error));
  const res = await resetPassword(parsed.data.phone, parsed.data.code, parsed.data.password);
  if (!res.ok) return res;
  return { ok: true, data: { ok: true } };
}
```

- [ ] **Step 2: Create the auth layout**

`src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Broker CRM</h1>
      {children}
    </main>
  );
}
```

- [ ] **Step 3: Create the login page (client form + server action)**

`src/app/(auth)/login/page.tsx`:
```tsx
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return <LoginForm />;
}
```

`src/components/forms/login-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const res = await loginAction(fd);
          if (res.ok) router.push("/dashboard");
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or phone</Label>
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Create register, verify, set-password pages**

`src/app/(auth)/register/page.tsx` renders `RegisterForm` (client) that posts `fullName`, `phone`, `email`, `role` select, `consent` checkbox to `registerAction`, and on success redirects to `/verify?phone=<phone>`.

`src/components/forms/register-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const res = await registerAction(fd);
          if (res.ok) router.push(`/verify?phone=${encodeURIComponent(res.data.phone)}`);
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" name="phone" placeholder="+91 98765 43210" required /></div>
      <div className="space-y-2"><Label htmlFor="email">Email (optional)</Label><Input id="email" name="email" type="email" /></div>
      <div className="space-y-2">
        <Label htmlFor="role">I am registering as</Label>
        <select id="role" name="role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="MAIN_BROKER">Channel Partner</option>
          <option value="REFERRAL_BROKER">Referral Partner</option>
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1" required />
        <span>I consent to the privacy notice and terms, and to being contacted about my account.</span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending code..." : "Create account"}</Button>
    </form>
  );
}
```

`src/app/(auth)/verify/page.tsx`:
```tsx
import { VerifyForm } from "@/components/forms/verify-form";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  return <VerifyForm phone={phone ?? ""} />;
}
```

`src/components/forms/verify-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyOtpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function VerifyForm({ phone }: { phone: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          fd.set("phone", phone);
          const res = await verifyOtpAction(fd);
          if (res.ok) router.push(`/set-password?userId=${encodeURIComponent(res.data.userId)}`);
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {phone}.</p>
      <div className="space-y-2"><Label htmlFor="code">Verification code</Label><Input id="code" name="code" inputMode="numeric" maxLength={6} required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Verifying..." : "Verify"}</Button>
    </form>
  );
}
```

`src/app/(auth)/set-password/page.tsx`:
```tsx
import { SetPasswordForm } from "@/components/forms/set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const { userId } = await searchParams;
  return <SetPasswordForm userId={userId ?? ""} />;
}
```

`src/components/forms/set-password-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function SetPasswordForm({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          fd.set("userId", userId);
          const res = await setPasswordAction(fd);
          if (res.ok) router.push("/dashboard");
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required /></div>
      <p className="text-xs text-muted-foreground">At least 10 characters, including a letter and a digit.</p>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving..." : "Set password & continue"}</Button>
    </form>
  );
}
```

- [ ] **Step 5: Create forgot/reset password pages**

`src/app/(auth)/forgot-password/page.tsx` renders `ForgotPasswordForm` (client) posting phone to `resetRequestAction`, then redirecting to `/reset-password?phone=...`.
`src/app/(auth)/reset-password/page.tsx` renders `ResetPasswordForm` (client) posting phone, code, password, confirm to `resetConfirmAction`, then redirecting to `/login`.

`src/components/forms/forgot-password-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetRequestAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-4" action={(fd) => start(async () => {
      const res = await resetRequestAction(fd);
      if (res.ok) router.push(`/reset-password?phone=${encodeURIComponent(res.data.phone)}`);
      else setError(res.error);
    })}>
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" name="phone" required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending..." : "Send reset code"}</Button>
    </form>
  );
}
```

`src/components/forms/reset-password-form.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetConfirmAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm({ phone }: { phone: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-4" action={(fd) => start(async () => {
      fd.set("phone", phone);
      const res = await resetConfirmAction(fd);
      if (res.ok) router.push("/login");
      else setError(res.error);
    })}>
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="code">Code</Label><Input id="code" name="code" inputMode="numeric" maxLength={6} required /></div>
      <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving..." : "Reset password"}</Button>
    </form>
  );
}
```

`src/app/(auth)/reset-password/page.tsx`:
```tsx
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  return <ResetPasswordForm phone={phone ?? ""} />;
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass; `/login`, `/register`, `/verify`, `/set-password`, `/forgot-password`, `/reset-password` routes built.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): add auth server actions and login/register/verify/reset pages"
```

---

### Task 16: Route protection, role dashboards, and admin bootstrap

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/admin/brokers/page.tsx` (placeholder list, populated in later plan)
- Create: `src/app/(app)/admin/brokers/actions.ts` (approve/suspend/reactivate/deactivate)
- Create: `src/lib/services/brokers.ts`
- Create: `prisma/seed.ts` (admin bootstrap)
- Test: `src/lib/services/brokers.test.ts`

**Interfaces:**
- Produces: `listBrokers(actor)` and `setBrokerStatus(actor, userId, status)` in `src/lib/services/brokers.ts`; server actions `approveBrokerAction`, `suspendBrokerAction`, `reactivateBrokerAction`, `deactivateBrokerAction`; a guarded `(app)` layout that redirects unauthenticated users to `/login`.

- [ ] **Step 1: Implement `src/lib/services/brokers.ts`**

```ts
import { prisma } from "@/lib/db";
import { requireRoleOf, AuthError, type SessionUser } from "@/lib/authz";
import { revoke } from "@/lib/authz/helpers";
import type { UserStatus } from "@prisma/client";

export async function listBrokers(actor: SessionUser) {
  requireRoleOf(actor, ["ADMIN"]);
  return prisma.user.findMany({
    where: { role: { in: ["MAIN_BROKER", "REFERRAL_BROKER"] } },
    include: { brokerProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function setBrokerStatus(
  actor: SessionUser,
  userId: string,
  status: UserStatus
): Promise<void> {
  requireRoleOf(actor, ["ADMIN"]);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === "ADMIN") throw new AuthError(400, "Invalid target account");
  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED" || status === "DEACTIVATED") {
    await revoke(userId);
  }
}
```

- [ ] **Step 2: Add `revoke` re-export to `src/lib/authz/helpers.ts`**

Create `src/lib/authz/helpers.ts`:
```ts
export { revokeAllForUser as revoke } from "@/lib/auth/session";
```

- [ ] **Step 3: Write the failing test**

`src/lib/services/brokers.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { listBrokers, setBrokerStatus } from "./brokers";
import { AuthError } from "@/lib/authz";

const admin = { id: "admin1", role: "ADMIN" as const, status: "ACTIVE" as const };
const broker = { id: "b1", role: "MAIN_BROKER" as const, status: "ACTIVE" as const };
const PHONE = "+919990000005";

describe("brokers service", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.brokerProfile.deleteMany({ where: { user: { phoneNormalized: PHONE } } });
    await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  });

  it("admin can list brokers", async () => {
    await prisma.user.create({ data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "MAIN_BROKER", status: "PENDING" } });
    const rows = await listBrokers(admin);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("non-admin cannot list brokers", async () => {
    await expect(listBrokers(broker)).rejects.toBeInstanceOf(AuthError);
  });

  it("suspending revokes sessions", async () => {
    const u = await prisma.user.create({ data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "MAIN_BROKER", status: "ACTIVE" } });
    await prisma.session.create({ data: { userId: u.id, tokenHash: "h1", expiresAt: new Date(Date.now() + 1e6) } });
    await setBrokerStatus(admin, u.id, "SUSPENDED");
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/lib/services/brokers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/services/brokers.test.ts`
Expected: PASS (3 tests) after Step 1 implementation is present.

- [ ] **Step 6: Create the guarded app layout**

`src/app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/authz";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <nav className="hidden w-56 shrink-0 border-r p-4 md:block">
        <div className="mb-6 text-lg font-semibold">Broker CRM</div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard">Dashboard</Link>
          {user.role === "ADMIN" && <Link href="/admin/brokers">Brokers</Link>}
        </div>
        <form action={logoutAction} className="mt-8">
          <Button variant="outline" type="submit" className="w-full">Sign out</Button>
        </form>
      </nav>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Create dashboards**

`src/app/(app)/dashboard/page.tsx`:
```tsx
import { requireUser } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader><CardTitle>Signed in</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Role: {user.role}. Account status: {user.status}.
          {user.status === "PENDING" && " Your account is awaiting admin approval."}
        </CardContent>
      </Card>
    </div>
  );
}
```

`src/app/(app)/admin/brokers/page.tsx`:
```tsx
import { requireRole } from "@/lib/authz";
import { listBrokers } from "@/lib/services/brokers";
import { approveBrokerAction, suspendBrokerAction, reactivateBrokerAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminBrokersPage() {
  const admin = await requireRole("ADMIN");
  const brokers = await listBrokers(admin);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Brokers</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{b.brokerProfile?.fullName ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{b.brokerProfile?.brokerCode ?? "—"}</td>
                <td className="p-3">{b.role}</td>
                <td className="p-3"><Badge>{b.status}</Badge></td>
                <td className="flex gap-2 p-3">
                  {b.status === "PENDING" && (
                    <form action={approveBrokerAction.bind(null, b.id)}><Button variant="outline" type="submit">Approve</Button></form>
                  )}
                  {b.status === "ACTIVE" && (
                    <form action={suspendBrokerAction.bind(null, b.id)}><Button variant="destructive" type="submit">Suspend</Button></form>
                  )}
                  {b.status === "SUSPENDED" && (
                    <form action={reactivateBrokerAction.bind(null, b.id)}><Button variant="outline" type="submit">Reactivate</Button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create admin broker actions**

`src/app/(app)/admin/brokers/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/authz";
import { setBrokerStatus } from "@/lib/services/brokers";

export async function approveBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "ACTIVE");
  revalidatePath("/admin/brokers");
}

export async function suspendBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "SUSPENDED");
  revalidatePath("/admin/brokers");
}

export async function reactivateBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "ACTIVE");
  revalidatePath("/admin/brokers");
}

export async function deactivateBrokerAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await setBrokerStatus(admin, userId, "DEACTIVATED");
  revalidatePath("/admin/brokers");
}
```

- [ ] **Step 9: Admin bootstrap seed**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function code() {
  let out = "";
  while (out.length < 10) for (const b of randomBytes(10)) { if (b < 250) { out += ALPHABET[b % 32]; if (out.length === 10) break; } }
  return out;
}

async function main() {
  const phone = process.env.ADMIN_PHONE ?? "+919999999999";
  const existing = await prisma.user.findUnique({ where: { phoneNormalized: phone } });
  if (existing) {
    console.log("Admin already exists:", phone);
    return;
  }
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMeStr0ng";
  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  await prisma.user.create({
    data: {
      phoneOriginal: phone, phoneNormalized: phone,
      email: process.env.ADMIN_EMAIL ?? "admin@example.com",
      role: "ADMIN", status: "ACTIVE", phoneVerifiedAt: new Date(), consentAt: new Date(),
      passwordHash,
      brokerProfile: { create: { brokerCode: code(), fullName: "Administrator" } },
    },
  });
  console.log("Seeded admin:", phone, "(set ADMIN_PASSWORD in env to change)");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 10: Add `.env` admin vars and document**

Append to `.env` and `.env.example`:
```
ADMIN_PHONE="+919999999999"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD=""
```

- [ ] **Step 11: Verify end to end manually**

Run: `npm run db:seed && npm run typecheck && npm run lint && npm run build`
Expected: seed prints "Seeded admin"; build succeeds with all routes.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(auth): add guarded app layout, admin broker management, and admin seed"
```

---

### Task 17: Expired-OTP and suspended-session coverage tests

**Files:**
- Test: `src/lib/services/auth-security.test.ts`

**Interfaces:**
- Verifies the spec's critical cases 5, 6, 7 against the real database.

- [ ] **Step 1: Write the tests**

`src/lib/services/auth-security.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashOtpCode } from "@/lib/auth/otp";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, validateSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

const PHONE = "+919990000006";

describe("auth security", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.otpChallenge.deleteMany({ where: { phone: PHONE } });
    await prisma.user.deleteMany({ where: { phoneNormalized: PHONE } });
  });

  it("OTP cannot be reused after success", async () => {
    await prisma.otpChallenge.create({ data: { phone: PHONE, purpose: "LOGIN", codeHash: hashOtpCode("101010"), expiresAt: new Date(Date.now() + 60000) } });
    expect((await verifyOtp(PHONE, "LOGIN", "101010")).ok).toBe(true);
    expect((await verifyOtp(PHONE, "LOGIN", "101010")).ok).toBe(false);
  });

  it("expired OTP is rejected", async () => {
    await prisma.otpChallenge.create({ data: { phone: PHONE, purpose: "LOGIN", codeHash: hashOtpCode("101010"), expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifyOtp(PHONE, "LOGIN", "101010")).toEqual({ ok: false, reason: "expired" });
  });

  it("suspended users cannot use existing sessions", async () => {
    const u = await prisma.user.create({ data: { phoneOriginal: PHONE, phoneNormalized: PHONE, role: "MAIN_BROKER", status: "ACTIVE", passwordHash: await hashPassword("Str0ngPassw0rd") } });
    const { token } = await createSession(u.id);
    expect(await validateSession(token)).not.toBeNull();
    await prisma.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    expect(await validateSession(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test -- src/lib/services/auth-security.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(auth): cover OTP replay, expiry, and suspended-session invalidation"
```

---

## Phase Completion Report

After Task 17, report: files created/changed, commands executed, tests actually passed/failed, known issues, and next steps (Plan 2: Core CRM).

## Self-Review

- **Spec coverage:** Tasks 1–17 cover Foundation (Phase 2) and Auth/RBAC (Phase 3): stack, Prisma schema, env validation, codes, phone normalization, Argon2id, sessions, OTP with provider abstraction + dev guard, registration/OTP/password, login/OTP-login/logout/reset, RBAC guards + record scoping, guarded routes, admin broker status management, and the spec's critical cases 5/6/7. Duplicate detection, property, leads, follow-ups, reports, CSV, PWA are intentionally deferred to later plans.
- **Placeholder scan:** No TBD/TODO; all code steps contain runnable content.
- **Type consistency:** `SessionUser` comes from `src/lib/auth/session.ts` and is re-exported by `src/lib/authz`. `ActionResult`/`actionError`/`actionSuccess` defined in Task 12 and used consistently. `ZodIssueCode` enum used in Task 12 (Zod 3.x). `requireRoleOf` defined in Task 11 and used in Task 16.
- **Note for implementers:** `src/lib/services/brokers.ts` imports `revoke` from `src/lib/authz/helpers.ts`, created in Task 16 Step 2. Run `npx prisma generate` after any schema change.
