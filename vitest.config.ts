import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    // Integration suites share one PostgreSQL database and clean tables in
    // before-each hooks, so running files in parallel causes cross-suite
    // contamination (deleted foreign keys, flaky failures). Run them serially.
    fileParallelism: false,
    // Remote (Neon) connections can be slow to open on a cold start; the
    // default 10s hook budget is too tight for the first resetDb()/seed.
    hookTimeout: 30000,
    // The heaviest flows (completeRegistration) make many sequential round
    // trips to remote Neon and can exceed the default 5s per-test budget.
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
