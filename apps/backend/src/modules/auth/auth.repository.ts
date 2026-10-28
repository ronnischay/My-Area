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
}

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
  };
}
