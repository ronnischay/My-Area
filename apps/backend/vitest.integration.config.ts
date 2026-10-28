import { defineConfig } from "vitest/config";

// Repository tests against the real test database (DATABASE_URL_TEST). Run: npm run test:integration -w backend
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    // Files share one database and truncate it between tests, so they must not run in parallel.
    fileParallelism: false,
  },
});
