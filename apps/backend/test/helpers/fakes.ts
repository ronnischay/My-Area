import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailSender } from "../../src/providers/email.provider.js";
import type { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import type { ReportsRepository } from "../../src/modules/reports/reports.repository.js";
import type {
  MediaPurpose,
  MediaType,
  ReportCategory,
  ReportRecord,
  ReportStatus,
} from "../../src/modules/reports/reports.types.js";
import type { SocietiesRepository } from "../../src/modules/societies/societies.repository.js";
import type { MemberListQuery, UsersRepository } from "../../src/modules/users/users.repository.js";
import type { MemberRecord, UserRole, UserStatus } from "../../src/modules/users/users.types.js";

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

export interface ReportRow {
  id: string;
  societyId: string;
  createdById: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportMediaRow {
  id: string;
  reportId: string;
  purpose: MediaPurpose;
  mediaType: MediaType;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export class InMemoryStore {
  users = new Map<string, UserRow>();
  societies = new Map<string, SocietyRow>();
  /** Keyed by token hash. */
  sessions = new Map<string, TokenRow>();
  /** Keyed by user id: at most one invite per user, like user_invites_user_id_uq. */
  invites = new Map<string, TokenRow>();
  reports = new Map<string, ReportRow>();
  reportMedia = new Map<string, ReportMediaRow>();
  /** Set to make the next report write throw, like a lost database connection. */
  failReportWrites: Error | null = null;

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

export function createFakeUsersRepository(store: InMemoryStore): UsersRepository {
  const toMember = (user: UserRow): MemberRecord => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    hasPassword: user.passwordHash !== null,
    inviteExpiresAt: store.invites.get(user.id)?.expiresAt ?? null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  });

  const memberOf = (societyId: string, userId: string) => {
    const user = store.users.get(userId);
    return user && user.societyId === societyId ? user : undefined;
  };

  return {
    async list(societyId, { role, status, q, page, pageSize }: MemberListQuery) {
      const needle = q?.toLowerCase();
      const matches = [...store.users.values()]
        .filter((u) => u.societyId === societyId)
        .filter((u) => !role || u.role === role)
        .filter((u) => !status || u.status === status)
        .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = (page - 1) * pageSize;
      return { items: matches.slice(start, start + pageSize).map(toMember), total: matches.length };
    },

    async findMember(societyId, userId) {
      const user = memberOf(societyId, userId);
      return user ? toMember(user) : null;
    },

    async findInviter(adminId) {
      const admin = store.users.get(adminId);
      const society = admin?.societyId ? store.societies.get(admin.societyId) : undefined;
      return admin && society ? { name: admin.name, societyName: society.name } : null;
    },

    async createInvitedMember({ societyId, invitedById, name, email, role, invite }) {
      if ([...store.users.values()].some((u) => u.email === email)) return "EMAIL_TAKEN";
      const user: UserRow = {
        id: store.newId(),
        societyId,
        email,
        name,
        role,
        status: "INVITED",
        passwordHash: null,
        invitedById,
        lastLoginAt: null,
        createdAt: store.nextCreatedAt(),
      };
      store.users.set(user.id, user);
      store.invites.set(user.id, { userId: user.id, ...invite });
      return toMember(user);
    },

    async replaceInvite(userId, invite) {
      store.invites.set(userId, { userId, ...invite });
    },

    async updateMember(societyId, userId, patch) {
      const user = memberOf(societyId, userId);
      if (!user) return null;
      if (patch.role) user.role = patch.role;
      if (patch.status) user.status = patch.status;
      if (patch.status === "DISABLED") {
        for (const [hash, session] of store.sessions) if (session.userId === userId) store.sessions.delete(hash);
        store.invites.delete(userId);
      }
      return toMember(user);
    },

    async createAdmin({ email, name, passwordHash }) {
      if ([...store.users.values()].some((u) => u.email === email)) return "EMAIL_TAKEN";
      const user: UserRow = {
        id: store.newId(),
        societyId: null,
        email,
        name,
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash,
        invitedById: null,
        lastLoginAt: null,
        createdAt: store.nextCreatedAt(),
      };
      store.users.set(user.id, user);
      return { id: user.id };
    },
  };
}

export function createFakeReportsRepository(store: InMemoryStore): ReportsRepository {
  const mediaOf = (reportId: string) =>
    [...store.reportMedia.values()]
      .filter((m) => m.reportId === reportId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const toRecord = (report: ReportRow): ReportRecord => {
    const author = store.users.get(report.createdById);
    if (!author) throw new Error("report author missing");
    return {
      id: report.id,
      title: report.title,
      description: report.description,
      category: report.category,
      locationText: report.locationText,
      status: report.status,
      resolvedAt: report.resolvedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      createdBy: { id: author.id, name: author.name },
      media: mediaOf(report.id).map((m) => ({
        id: m.id,
        purpose: m.purpose,
        mediaType: m.mediaType,
        url: m.url,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        width: m.width,
        height: m.height,
        createdAt: m.createdAt,
      })),
    };
  };

  return {
    async create(input) {
      if (store.failReportWrites) throw store.failReportWrites;
      // Mirrors reports_created_by_same_society_fk.
      if (store.users.get(input.createdById)?.societyId !== input.societyId) throw new Error("reporter not in society");
      const createdAt = store.nextCreatedAt();
      const report: ReportRow = { id: store.newId(), ...input, status: "OPEN", resolvedAt: null, createdAt, updatedAt: createdAt };
      store.reports.set(report.id, report);
      return toRecord(report);
    },

    async list(societyId, { status, category, createdById, q, sort, page, pageSize }) {
      const needle = q?.toLowerCase();
      const direction = sort === "oldest" ? 1 : -1;
      const matches = [...store.reports.values()]
        .filter((r) => r.societyId === societyId)
        .filter((r) => !status || r.status === status)
        .filter((r) => !category || r.category === category)
        .filter((r) => !createdById || r.createdById === createdById)
        .filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.locationText.toLowerCase().includes(needle))
        .sort((a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()));
      const start = (page - 1) * pageSize;
      const items = matches.slice(start, start + pageSize).map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        locationText: r.locationText,
        status: r.status,
        createdById: r.createdById,
        thumbnailUrl: mediaOf(r.id).find((m) => m.purpose === "SUBMISSION")?.url ?? null,
        createdAt: r.createdAt,
      }));
      return { items, total: matches.length };
    },

    async findById(societyId, reportId) {
      const report = store.reports.get(reportId);
      return report && report.societyId === societyId ? toRecord(report) : null;
    },
  };
}

/** Records messages instead of sending. Set `failWith` to make the next sends throw. */
export class FakeEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  failWith: Error | null = null;

  async send(message: EmailMessage) {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
    return { messageId: `fake-${this.sent.length}` };
  }
}
