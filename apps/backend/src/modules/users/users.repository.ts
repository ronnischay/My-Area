import { and, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { isUniqueViolation } from "../../db/errors.js";
import { containsPattern } from "../../db/like.js";
import { sessions, societies, userInvites, users } from "../../db/schema/index.js";
import { offsetOf } from "../../lib/pagination.js";
import type { MemberRecord, MemberRole, UserRole, UserStatus } from "./users.types.js";

export interface MemberListQuery {
  role?: UserRole;
  status?: UserStatus;
  q?: string;
  page: number;
  pageSize: number;
}

/** Where an email that can't be invited already has its account. */
export type EmailConflict = "THIS_SOCIETY" | "OTHER_SOCIETY" | "ADMIN";

export interface NewInvite {
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Every member query takes `societyId` and filters by it: an id from another society behaves
 * exactly like an id that doesn't exist (docs/API_CONTRACT.md §3).
 */
export interface UsersRepository {
  list(societyId: string, query: MemberListQuery): Promise<{ items: MemberRecord[]; total: number }>;
  findMember(societyId: string, userId: string): Promise<MemberRecord | null>;
  /** Names used in the invite email: the inviter (admin or manager) and the society they invite to. */
  findInviter(inviterId: string, societyId: string): Promise<{ name: string; societyName: string } | null>;
  /**
   * One transaction: INVITED user + invite. One account per email across the app, so an email that
   * already has one returns where it is: in this society, another society (one society per person), or an admin.
   */
  createInvitedMember(input: {
    societyId: string;
    invitedById: string;
    name: string;
    email: string;
    role: MemberRole;
    invite: NewInvite;
  }): Promise<MemberRecord | { conflict: EmailConflict }>;
  /** One transaction: delete the old invite (its link stops working) and insert the new one. */
  replaceInvite(userId: string, invite: NewInvite): Promise<void>;
  /** Disabling also deletes the member's sessions and invite in the same transaction. */
  updateMember(
    societyId: string,
    userId: string,
    patch: { role?: MemberRole; status?: UserStatus },
  ): Promise<MemberRecord | null>;
  /** For the user:create-admin CLI: an ACTIVE admin, who never belongs to a society (D028). */
  createAdmin(input: { email: string; name: string; passwordHash: string }): Promise<{ id: string } | "EMAIL_TAKEN">;
}

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL`,
  inviteExpiresAt: userInvites.expiresAt,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

export function createUsersRepository(db: Database): UsersRepository {
  const findMember = async (societyId: string, userId: string) => {
    const [row] = await db
      .select(memberColumns)
      .from(users)
      .leftJoin(userInvites, eq(userInvites.userId, users.id))
      .where(and(eq(users.id, userId), eq(users.societyId, societyId)))
      .limit(1);
    return row ?? null;
  };

  return {
    findMember,

    async list(societyId, { role, status, q, page, pageSize }) {
      const filters: SQL[] = [eq(users.societyId, societyId)];
      if (role) filters.push(eq(users.role, role));
      if (status) filters.push(eq(users.status, status));
      if (q) {
        const search = or(ilike(users.name, containsPattern(q)), ilike(users.email, containsPattern(q)));
        if (search) filters.push(search);
      }
      const where = and(...filters);

      const [items, [totals]] = await Promise.all([
        db
          .select(memberColumns)
          .from(users)
          .leftJoin(userInvites, eq(userInvites.userId, users.id))
          .where(where)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(pageSize)
          .offset(offsetOf(page, pageSize)),
        db.select({ total: count() }).from(users).where(where),
      ]);
      return { items, total: totals?.total ?? 0 };
    },

    async findInviter(inviterId, societyId) {
      const [row] = await db
        .select({ name: users.name, societyName: societies.name })
        .from(users)
        .innerJoin(societies, eq(societies.id, societyId))
        .where(eq(users.id, inviterId))
        .limit(1);
      return row ?? null;
    },

    async createInvitedMember({ societyId, invitedById, name, email, role, invite }) {
      let userId: string;
      try {
        userId = await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({ societyId, invitedById, name, email, role, status: "INVITED" })
            .returning({ id: users.id });
          if (!user) throw new Error("user insert returned no row");
          await tx.insert(userInvites).values({ userId: user.id, ...invite });
          return user.id;
        });
      } catch (err) {
        if (!isUniqueViolation(err, "users_email_uq")) throw err;
        const [existing] = await db.select({ role: users.role, societyId: users.societyId }).from(users).where(eq(users.email, email)).limit(1);
        if (!existing) throw err;
        return { conflict: existing.role === "ADMIN" ? "ADMIN" : existing.societyId === societyId ? "THIS_SOCIETY" : "OTHER_SOCIETY" };
      }
      const member = await findMember(societyId, userId);
      if (!member) throw new Error("invited member not found after insert");
      return member;
    },

    async replaceInvite(userId, invite) {
      await db.transaction(async (tx) => {
        await tx.delete(userInvites).where(eq(userInvites.userId, userId));
        await tx.insert(userInvites).values({ userId, ...invite });
      });
    },

    async updateMember(societyId, userId, patch) {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(users)
          .set(patch)
          .where(and(eq(users.id, userId), eq(users.societyId, societyId)))
          .returning({ id: users.id });
        if (!row) return false;
        if (patch.status === "DISABLED") {
          await tx.delete(sessions).where(eq(sessions.userId, userId));
          await tx.delete(userInvites).where(eq(userInvites.userId, userId));
        }
        return true;
      });
      return updated ? findMember(societyId, userId) : null;
    },

    async createAdmin({ email, name, passwordHash }) {
      try {
        const [row] = await db
          .insert(users)
          .values({ email, name, passwordHash, role: "ADMIN", status: "ACTIVE" })
          .returning({ id: users.id });
        if (!row) throw new Error("admin insert returned no row");
        return row;
      } catch (err) {
        if (isUniqueViolation(err, "users_email_uq")) return "EMAIL_TAKEN";
        throw err;
      }
    },
  };
}
