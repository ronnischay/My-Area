import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { societies, users } from "../../db/schema/index.js";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER";
}

/** Who can be told about a new report: the society's ACTIVE managers and admins. */
export interface NotificationsRepository {
  findSocietyStaff(societyId: string): Promise<{ societyName: string; staff: StaffMember[] } | null>;
}

export function createNotificationsRepository(db: Database): NotificationsRepository {
  return {
    async findSocietyStaff(societyId) {
      const [society] = await db.select({ name: societies.name }).from(societies).where(eq(societies.id, societyId)).limit(1);
      if (!society) return null;
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(and(eq(users.societyId, societyId), eq(users.status, "ACTIVE"), inArray(users.role, ["ADMIN", "MANAGER"])))
        .orderBy(users.createdAt);
      return { societyName: society.name, staff: rows.map((row) => ({ ...row, role: row.role === "ADMIN" ? "ADMIN" : "MANAGER" })) };
    },
  };
}
