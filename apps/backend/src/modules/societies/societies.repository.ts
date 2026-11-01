import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { societies, users } from "../../db/schema/index.js";
import type { Society, SocietyInput, SocietySummary } from "./societies.types.js";

const societyColumns = {
  id: societies.id,
  name: societies.name,
  addressText: societies.addressText,
  createdAt: societies.createdAt,
};

/** Societies are run by admins, who belong to none of them (D028): nothing here links a user. */
export interface SocietiesRepository {
  /** Newest first, with member counts. */
  list(): Promise<SocietySummary[]>;
  findById(societyId: string): Promise<Society | null>;
  create(input: SocietyInput): Promise<Society>;
  update(societyId: string, patch: Partial<SocietyInput>): Promise<Society | null>;
}

export function createSocietiesRepository(db: Database): SocietiesRepository {
  return {
    async list() {
      return db
        .select({
          ...societyColumns,
          managerCount: sql<number>`count(${users.id}) filter (where ${users.role} = 'MANAGER')`.mapWith(Number),
          residentCount: sql<number>`count(${users.id}) filter (where ${users.role} = 'RESIDENT')`.mapWith(Number),
        })
        .from(societies)
        .leftJoin(users, eq(users.societyId, societies.id))
        .groupBy(societies.id)
        .orderBy(desc(societies.createdAt), desc(societies.id));
    },

    async findById(societyId) {
      const [society] = await db.select(societyColumns).from(societies).where(eq(societies.id, societyId)).limit(1);
      return society ?? null;
    },

    async create(input) {
      const [society] = await db.insert(societies).values(input).returning(societyColumns);
      if (!society) throw new Error("society insert returned no row");
      return society;
    },

    async update(societyId, patch) {
      const [society] = await db.update(societies).set(patch).where(eq(societies.id, societyId)).returning(societyColumns);
      return society ?? null;
    },
  };
}
