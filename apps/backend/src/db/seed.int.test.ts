import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { testDatabaseUrl, useTestDatabase } from "../../test/helpers/db.js";
import { seedDemoData, SEED_USERS } from "./seed.js";
import { reports, societies, users } from "./schema/index.js";

const now = new Date("2026-10-28T10:00:00.000Z");
const passwordHash = "scrypt$1024$8$1$c2FsdA$a2V5";

describe.skipIf(!testDatabaseUrl)("seedDemoData (PostgreSQL)", () => {
  const db = useTestDatabase();

  it("creates one society, four active members and ten reports, and is safe to run twice", async () => {
    expect(await seedDemoData(db, { passwordHash, now })).toEqual({ created: true, users: 4, reports: 10 });
    expect(await seedDemoData(db, { passwordHash, now })).toEqual({ created: false });

    const [society] = await db.select().from(societies);
    expect(await db.select({ n: count() }).from(societies)).toEqual([{ n: 1 }]);
    const members = await db.select().from(users).where(eq(users.societyId, society!.id));
    expect(members.map((m) => m.email).sort()).toEqual(SEED_USERS.map((u) => u.email).sort());
    expect(members.every((m) => m.status === "ACTIVE" && m.passwordHash === passwordHash)).toBe(true);

    const rows = await db.select().from(reports);
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]));
    expect(rows.every((r) => r.createdAt < now && r.societyId === society!.id)).toBe(true);
  });
});
