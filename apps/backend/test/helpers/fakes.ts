import { randomUUID } from "node:crypto";
import type { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import type { SocietiesRepository } from "../../src/modules/societies/societies.repository.js";
import type { UserRole, UserStatus } from "../../src/modules/users/users.types.js";

/**
 * In-memory stand-ins for the Drizzle repositories, with the same contracts (tenant scoping,
 * single-use invites, session expiry). The real SQL is covered by *.int.test.ts against the test DB.
 */

export interface UserRow {
  id: string;
  societyId: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string | null;
  invitedById: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface SocietyRow {
  id: string;
  name: string;
  addressText: string;
  createdAt: Date;
}

export interface TokenRow {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export class InMemoryStore {
  users = new Map<string, UserRow>();
  societies = new Map<string, SocietyRow>();
  /** Keyed by token hash. */
  sessions = new Map<string, TokenRow>();
  /** Keyed by user id: at most one invite per user, like user_invites_user_id_uq. */
  invites = new Map<string, TokenRow>();

  private sequence = 0;

  /** Strictly increasing timestamps so "newest first" ordering is deterministic. */
  nextCreatedAt(): Date {
    this.sequence += 1;
    return new Date(Date.UTC(2026, 0, 1) + this.sequence * 1000);
  }

  newId(): string {
    return randomUUID();
  }
}

export function createFakeAuthRepository(store: InMemoryStore): AuthRepository {
  const inviteByHash = (tokenHash: string, now: Date) => {
    for (const invite of store.invites.values()) {
      const user = store.users.get(invite.userId);
      if (invite.tokenHash === tokenHash && invite.expiresAt > now && user?.status === "INVITED") return { invite, user };
    }
    return null;
  };

  return {
    async findCredentialsByEmail(email) {
      const user = [...store.users.values()].find((u) => u.email === email);
      return user ? { id: user.id, role: user.role, status: user.status, passwordHash: user.passwordHash } : null;
    },

    async startSession({ userId, session, now }) {
      for (const [hash, row] of store.sessions) {
        if (row.userId === userId && row.expiresAt <= now) store.sessions.delete(hash);
      }
      store.sessions.set(session.tokenHash, { userId, ...session });
      const user = store.users.get(userId);
      if (user) user.lastLoginAt = now;
    },

    async findSessionUser(tokenHash, now) {
      const session = store.sessions.get(tokenHash);
      const user = session && session.expiresAt > now ? store.users.get(session.userId) : undefined;
      return user ? { userId: user.id, role: user.role, status: user.status, societyId: user.societyId } : null;
    },

    async deleteSession(tokenHash) {
      store.sessions.delete(tokenHash);
    },

    async findCurrentUser(userId) {
      const user = store.users.get(userId);
      if (!user) return null;
      const society = user.societyId ? (store.societies.get(user.societyId) ?? null) : null;
      return { id: user.id, name: user.name, email: user.email, role: user.role, society: society ? { ...society } : null };
    },

    async findInvite(tokenHash, now) {
      const found = inviteByHash(tokenHash, now);
      const society = found?.user.societyId ? store.societies.get(found.user.societyId) : undefined;
      if (!found || !society) return null;
      const { user, invite } = found;
      return { userId: user.id, name: user.name, email: user.email, role: user.role, societyName: society.name, expiresAt: invite.expiresAt };
    },

    async acceptInvite({ tokenHash, passwordHash, session, now }) {
      const found = inviteByHash(tokenHash, now);
      if (!found) return null;
      const { user } = found;
      user.passwordHash = passwordHash;
      user.status = "ACTIVE";
      user.lastLoginAt = now;
      store.invites.delete(user.id);
      store.sessions.set(session.tokenHash, { userId: user.id, ...session });
      return user.id;
    },
  };
}

export function createFakeSocietiesRepository(store: InMemoryStore): SocietiesRepository {
  return {
    async createForAdmin(adminId, input) {
      const admin = store.users.get(adminId);
      if (!admin) throw new Error("admin not found");
      if (admin.societyId) return "ALREADY_EXISTS";
      const society: SocietyRow = { id: store.newId(), ...input, createdAt: store.nextCreatedAt() };
      store.societies.set(society.id, society);
      admin.societyId = society.id;
      return { ...society };
    },

    async update(societyId, patch) {
      const society = store.societies.get(societyId);
      if (!society) return null;
      Object.assign(society, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      return { ...society };
    },
  };
}
