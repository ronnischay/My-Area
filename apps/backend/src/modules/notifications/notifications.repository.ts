import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { societies, users } from "../../db/schema/index.js";

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

/** Who is told about a new report: the society's ACTIVE managers (admins belong to no society, D028). */
export interface NotificationsRepository {
  findSocietyManagers(societyId: string): Promise<{ societyName: string; managers: Recipient[] } | null>;
}

export function createNotificationsRepository(db: Database): NotificationsRepository {
  return {
    async findSocietyManagers(societyId) {
      const [society] = await db.select({ name: societies.name }).from(societies).where(eq(societies.id, societyId)).limit(1);
      if (!society) return null;
      const managers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.societyId, societyId), eq(users.status, "ACTIVE"), eq(users.role, "MANAGER")))
        .orderBy(users.createdAt);
      return { societyName: society.name, managers };
    },
  };
}
