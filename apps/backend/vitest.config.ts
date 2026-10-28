import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Repository integration tests (*.int.test.ts) get their own run against DATABASE_URL_TEST from Phase 2.
    exclude: ["src/**/*.int.test.ts"],
  },
});
