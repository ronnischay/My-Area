import { eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { societies, users } from "../../db/schema/index.js";
import type { Society, SocietyInput } from "./societies.types.js";

const societyColumns = {
  id: societies.id,
  name: societies.name,
  addressText: societies.addressText,
  createdAt: societies.createdAt,
};

export interface SocietiesRepository {
  /**
   * One transaction: lock the admin row, refuse if they already have a society,
   * insert the society and link the admin to it.
   */
  createForAdmin(adminId: string, input: SocietyInput): Promise<Society | "ALREADY_EXISTS">;
  update(societyId: string, patch: Partial<SocietyInput>): Promise<Society | null>;
}

export function createSocietiesRepository(db: Database): SocietiesRepository {
  return {
    async createForAdmin(adminId, input) {
      return db.transaction(async (tx) => {
        const [admin] = await tx
          .select({ societyId: users.societyId })
          .from(users)
          .where(eq(users.id, adminId))
          .for("update")
          .limit(1);
        if (!admin) throw new Error("admin not found");
        if (admin.societyId) return "ALREADY_EXISTS";

        const [society] = await tx.insert(societies).values(input).returning(societyColumns);
        if (!society) throw new Error("society insert returned no row");
        await tx.update(users).set({ societyId: society.id }).where(eq(users.id, adminId));
        return society;
      });
    },

    async update(societyId, patch) {
      const [society] = await db.update(societies).set(patch).where(eq(societies.id, societyId)).returning(societyColumns);
      return society ?? null;
    },
  };
}
