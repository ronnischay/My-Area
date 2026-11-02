import { and, eq, gt, lte } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { sessions, societies, userInvites, users } from "../../db/schema/index.js";
import type { UserRole, UserStatus } from "../users/users.types.js";
import type { CurrentUser, InviteDetails } from "./auth.types.js";

export interface UserCredentials {
  id: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string | null;
}

export interface SessionUser {
  userId: string;
  role: UserRole;
  status: UserStatus;
  societyId: string | null;
}

/** What forgot password needs about an account. */
export interface ResetAccount {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  passwordHash: string | null;
}

export interface NewSession {
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  /** One transaction: drop the user's expired sessions, insert the new one, set last_login_at. */
  startSession(input: { userId: string; session: NewSession; now: Date }): Promise<void>;
  /** Unexpired session joined to its user, or null. */
  findSessionUser(tokenHash: string, now: Date): Promise<SessionUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  findCurrentUser(userId: string): Promise<CurrentUser | null>;
  /** Unexpired invite for a user who is still INVITED, or null. */
  findInvite(tokenHash: string, now: Date): Promise<InviteDetails | null>;
  /**
   * One transaction: re-check and lock the invite, activate the user with the password hash,
   * delete the invite (single use) and start a session. Returns the user id, or null if the invite is no longer valid.
   */
  acceptInvite(input: { tokenHash: string; passwordHash: string; session: NewSession; now: Date }): Promise<string | null>;
  findResetAccountByEmail(email: string): Promise<ResetAccount | null>;
  findResetAccountById(userId: string): Promise<ResetAccount | null>;
  /**
   * One transaction: lock the user, and only if they are still ACTIVE with `expectedPasswordHash`
   * (so a reset link works once), set the new hash, delete ALL their sessions and start this one.
   * False when the link is no longer valid.
   */
  resetPassword(input: { userId: string; expectedPasswordHash: string; passwordHash: string; session: NewSession; now: Date }): Promise<boolean>;
  /** Deletes every expired session; returns how many. */
  deleteExpiredSessions(now: Date): Promise<number>;
}

const resetAccountColumns = { id: users.id, email: users.email, name: users.name, status: users.status, passwordHash: users.passwordHash };

export function createAuthRepository(db: Database): AuthRepository {
  return {
    async findCredentialsByEmail(email) {
      const [row] = await db
        .select({ id: users.id, role: users.role, status: users.status, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async startSession({ userId, session, now }) {
      await db.transaction(async (tx) => {
        await tx.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));
        await tx.insert(sessions).values({ userId, tokenHash: session.tokenHash, expiresAt: session.expiresAt });
        await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));
      });
    },

    async findSessionUser(tokenHash, now) {
      const [row] = await db
        .select({ userId: users.id, role: users.role, status: users.status, societyId: users.societyId })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);
      return row ?? null;
    },

    async deleteSession(tokenHash) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },

    async findCurrentUser(userId) {
      const [row] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          societyId: societies.id,
          societyName: societies.name,
          societyAddressText: societies.addressText,
          societyCreatedAt: societies.createdAt,
        })
        .from(users)
        .leftJoin(societies, eq(societies.id, users.societyId))
        .where(eq(users.id, userId))
        .limit(1);
      if (!row) return null;

      const { societyId, societyName, societyAddressText, societyCreatedAt, ...user } = row;
      const society =
        societyId && societyName && societyAddressText && societyCreatedAt
          ? { id: societyId, name: societyName, addressText: societyAddressText, createdAt: societyCreatedAt }
          : null;
      return { ...user, society };
    },

    async findInvite(tokenHash, now) {
      const [row] = await db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          societyName: societies.name,
          expiresAt: userInvites.expiresAt,
        })
        .from(userInvites)
        .innerJoin(users, eq(users.id, userInvites.userId))
        .innerJoin(societies, eq(societies.id, users.societyId))
        .where(and(eq(userInvites.tokenHash, tokenHash), gt(userInvites.expiresAt, now), eq(users.status, "INVITED")))
        .limit(1);
      return row ?? null;
    },

    async acceptInvite({ tokenHash, passwordHash, session, now }) {
      return db.transaction(async (tx) => {
        const [invite] = await tx
          .select({ id: userInvites.id, userId: userInvites.userId })
          .from(userInvites)
          .innerJoin(users, eq(users.id, userInvites.userId))
          .where(and(eq(userInvites.tokenHash, tokenHash), gt(userInvites.expiresAt, now), eq(users.status, "INVITED")))
          .for("update")
          .limit(1);
        if (!invite) return null;

        await tx
          .update(users)
          .set({ passwordHash, status: "ACTIVE", lastLoginAt: now })
          .where(eq(users.id, invite.userId));
        await tx.delete(userInvites).where(eq(userInvites.id, invite.id));
        await tx.insert(sessions).values({ userId: invite.userId, tokenHash: session.tokenHash, expiresAt: session.expiresAt });
        return invite.userId;
      });
    },

    async findResetAccountByEmail(email) {
      const [row] = await db.select(resetAccountColumns).from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },

    async findResetAccountById(userId) {
      const [row] = await db.select(resetAccountColumns).from(users).where(eq(users.id, userId)).limit(1);
      return row ?? null;
    },

    async resetPassword({ userId, expectedPasswordHash, passwordHash, session, now }) {
      return db.transaction(async (tx) => {
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.status, "ACTIVE"), eq(users.passwordHash, expectedPasswordHash)))
          .for("update")
          .limit(1);
        if (!user) return false;

        await tx.update(users).set({ passwordHash, lastLoginAt: now }).where(eq(users.id, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.insert(sessions).values({ userId, tokenHash: session.tokenHash, expiresAt: session.expiresAt });
        return true;
      });
    },

    async deleteExpiredSessions(now) {
      const deleted = await db.delete(sessions).where(lte(sessions.expiresAt, now)).returning({ id: sessions.id });
      return deleted.length;
    },
  };
}
