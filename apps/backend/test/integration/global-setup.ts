import { existsSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/db/migrate.js";

/**
 * Applies the committed migrations to DATABASE_URL_TEST once per run (which also proves they apply
 * cleanly) and hands the URL to the tests. Refuses anything that could be a real database.
 */
export default async function setup(project: TestProject) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL_TEST;

  if (!url) {
    console.warn("\n⚠ DATABASE_URL_TEST is not set: repository integration tests are SKIPPED (see apps/backend/.env.example)\n");
    project.provide("databaseUrl", "");
    return;
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL: integration tests empty every table");
  }
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("DATABASE_URL_TEST must point to a database whose name ends in _test");
  }

  await runMigrations(url);
  project.provide("databaseUrl", url);
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
