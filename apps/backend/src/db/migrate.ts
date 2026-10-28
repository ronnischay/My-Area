import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

/** Folder with the committed SQL migrations (apps/backend/drizzle), resolved from src/ or dist/. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Applies every pending migration. Used by integration-test setup and for deploys without drizzle-kit. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, pool } = createDatabase(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
