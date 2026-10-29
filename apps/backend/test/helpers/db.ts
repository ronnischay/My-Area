import { sql } from "drizzle-orm";
import { afterAll, beforeEach, inject } from "vitest";
import { createDatabase, type Database } from "../../src/db/client.js";
import { societies, users } from "../../src/db/schema/index.js";
import type { UserRole, UserStatus } from "../../src/modules/users/users.types.js";
import "../integration/global-setup.js";

/** Empty string when DATABASE_URL_TEST is unset; use with describe.skipIf(!testDatabaseUrl). */
export const testDatabaseUrl = inject("databaseUrl");

/** A Drizzle client on the test database, emptied before every test and closed after the file. */
export function useTestDatabase(): Database {
  if (!testDatabaseUrl) return undefined as unknown as Database;
  const { db, pool } = createDatabase(testDatabaseUrl);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE report_media, reports, sessions, user_invites, users, societies RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await pool.end();
  });

  return db;
}

export async function insertSociety(db: Database, name = "Green Park Residency") {
  const [row] = await db.insert(societies).values({ name, addressText: "Plot 12, Sector 45, Gurugram" }).returning();
  if (!row) throw new Error("society insert failed");
  return row;
}

export async function insertUser(
  db: Database,
  values: { email: string; role: UserRole; societyId: string | null; status?: UserStatus; passwordHash?: string | null; name?: string },
) {
  const [row] = await db
    .insert(users)
    .values({
      name: values.name ?? "Test User",
      status: "ACTIVE",
      passwordHash: values.status === "INVITED" ? null : "scrypt$1024$8$1$c2FsdA$a2V5",
      ...values,
    })
    .returning();
  if (!row) throw new Error("user insert failed");
  return row;
}
