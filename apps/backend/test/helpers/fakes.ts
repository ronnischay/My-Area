import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailSender } from "../../src/providers/email.provider.js";
import type { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import type { MediaRepository } from "../../src/modules/media/media.repository.js";
import type { NotificationsRepository } from "../../src/modules/notifications/notifications.repository.js";
import type { MediaStorage } from "../../src/providers/media-storage.js";
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
  providerPublicId: string;
  purpose: MediaPurpose;
  mediaType: MediaType;
  url: string;
  mimeType: string;
  createdAt: Date;
}

export interface StatusHistoryRow {
  id: string;
  reportId: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  changedById: string;
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
  statusHistory: StatusHistoryRow[] = [];
  /** `${reportId}:${voterId}`, like the report_votes primary key. */
  votes = new Set<string>();
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
    async list() {
      const count = (societyId: string, role: UserRole) => [...store.users.values()].filter((u) => u.societyId === societyId && u.role === role).length;
      return [...store.societies.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((society) => ({ ...society, managerCount: count(society.id, "MANAGER"), residentCount: count(society.id, "RESIDENT") }));
    },

    async findById(societyId) {
      const society = store.societies.get(societyId);
      return society ? { ...society } : null;
    },

    async create(input) {
      const society: SocietyRow = { id: store.newId(), ...input, createdAt: store.nextCreatedAt() };
      store.societies.set(society.id, society);
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

    async findInviter(inviterId, societyId) {
      const inviter = store.users.get(inviterId);
      const society = store.societies.get(societyId);
      return inviter && society ? { name: inviter.name, societyName: society.name } : null;
    },

    async createInvitedMember({ societyId, invitedById, name, email, role, invite }) {
      const existing = [...store.users.values()].find((u) => u.email === email);
      if (existing) return { conflict: existing.role === "ADMIN" ? "ADMIN" : existing.societyId === societyId ? "THIS_SOCIETY" : "OTHER_SOCIETY" };
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

  const votesFor = (reportId: string) => [...store.votes].filter((key) => key.startsWith(`${reportId}:`)).length;

  const toRecord = (report: ReportRow, viewerId?: string): ReportRecord => {
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
      voteCount: votesFor(report.id),
      hasVoted: viewerId !== undefined && store.votes.has(`${report.id}:${viewerId}`),
      media: mediaOf(report.id).map((m) => ({
        id: m.id,
        purpose: m.purpose,
        mediaType: m.mediaType,
        url: m.url,
        mimeType: m.mimeType,
        createdAt: m.createdAt,
      })),
      statusHistory: store.statusHistory
        .filter((h) => h.reportId === report.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(({ reportId: _r, changedById, ...h }) => {
          const by = store.users.get(changedById);
          return { ...h, changedBy: { id: changedById, name: by?.name ?? "" } };
        }),
    };
  };

  return {
    async create({ photo, ...input }) {
      if (store.failReportWrites) throw store.failReportWrites;
      // Mirrors reports_created_by_same_society_fk.
      if (store.users.get(input.createdById)?.societyId !== input.societyId) throw new Error("reporter not in society");
      const createdAt = store.nextCreatedAt();
      const report: ReportRow = { id: store.newId(), ...input, status: "OPEN", resolvedAt: null, createdAt, updatedAt: createdAt };
      store.reports.set(report.id, report);
      store.reportMedia.set(photo.id, {
        id: photo.id,
        reportId: report.id,
        providerPublicId: photo.providerPublicId,
        purpose: "SUBMISSION",
        mediaType: photo.mediaType,
        url: photo.url,
        mimeType: photo.mimeType,
        createdAt,
      });
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
        voteCount: votesFor(r.id),
        createdAt: r.createdAt,
      }));
      return { items, total: matches.length };
    },

    async findById(societyId, reportId, viewerId) {
      const report = store.reports.get(reportId);
      return report && report.societyId === societyId ? toRecord(report, viewerId) : null;
    },

    async addVote(reportId, voterId) {
      const key = `${reportId}:${voterId}`;
      if (store.votes.has(key)) return "DUPLICATE";
      store.votes.add(key);
      return "ADDED";
    },

    async removeVote(reportId, voterId) {
      return store.votes.delete(`${reportId}:${voterId}`);
    },

    async changeStatus({ societyId, reportId, to, note, changedById, at, isAllowed }) {
      if (store.failReportWrites) throw store.failReportWrites;
      const report = store.reports.get(reportId);
      if (!report || report.societyId !== societyId) return { outcome: "NOT_FOUND" };
      if (!(await isAllowed(report.status, to))) return { outcome: "REFUSED", from: report.status };
      store.statusHistory.push({ id: store.newId(), reportId, fromStatus: report.status, toStatus: to, note, changedById, createdAt: at });
      report.status = to;
      report.resolvedAt = to === "RESOLVED" ? at : null;
      report.updatedAt = at;
      return { outcome: "CHANGED", report: toRecord(report, changedById) };
    },

    async addResolutionMedia(societyId, reportId, { uploadedById: _u, ...media }) {
      if (store.failReportWrites) throw store.failReportWrites;
      const report = store.reports.get(reportId);
      if (!report || report.societyId !== societyId) return null;
      const row: ReportMediaRow = { ...media, reportId, purpose: "RESOLUTION", createdAt: store.nextCreatedAt() };
      store.reportMedia.set(row.id, row);
      return {
        id: row.id,
        purpose: row.purpose,
        mediaType: row.mediaType,
        url: row.url,
        mimeType: row.mimeType,
        createdAt: row.createdAt,
      };
    },

    async countByStatus(societyId) {
      const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
      for (const r of store.reports.values()) if (r.societyId === societyId) counts[r.status] += 1;
      return counts;
    },
  };
}

export function createFakeMediaRepository(store: InMemoryStore): MediaRepository {
  return {
    async findForSociety(societyId, mediaId) {
      const media = store.reportMedia.get(mediaId);
      const report = media ? store.reports.get(media.reportId) : undefined;
      return media && report?.societyId === societyId ? { providerPublicId: media.providerPublicId, mimeType: media.mimeType } : null;
    },
  };
}

/** Keeps files in memory. Set `failSaveWith` / `failDeleteWith` to simulate a full or broken disk. */
export class FakeMediaStorage implements MediaStorage {
  files = new Map<string, Buffer>();
  deleted: string[] = [];
  failSaveWith: Error | null = null;
  failDeleteWith: Error | null = null;

  async save(key: string, bytes: Buffer) {
    if (this.failSaveWith) throw this.failSaveWith;
    this.files.set(key, bytes);
  }

  async read(key: string) {
    return this.files.get(key) ?? null;
  }

  async delete(key: string) {
    this.deleted.push(key);
    if (this.failDeleteWith) throw this.failDeleteWith;
    this.files.delete(key);
  }
}

export function createFakeNotificationsRepository(store: InMemoryStore): NotificationsRepository {
  return {
    async findSocietyManagers(societyId) {
      const society = store.societies.get(societyId);
      if (!society) return null;
      const managers = [...store.users.values()]
        .filter((u) => u.societyId === societyId && u.status === "ACTIVE" && u.role === "MANAGER")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((u) => ({ id: u.id, name: u.name, email: u.email }));
      return { societyName: society.name, managers };
    },
  };
}

/**
 * Records messages instead of sending. `failWith` makes every send throw; `failFor` makes sends to
 * those addresses throw; `hang` makes sends never finish (a mail server that doesn't answer).
 */
export class FakeEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  failWith: Error | null = null;
  failFor = new Set<string>();
  hang = false;

  async send(message: EmailMessage) {
    if (this.hang) return new Promise<never>(() => {});
    if (this.failWith) throw this.failWith;
    if (this.failFor.has(message.to)) throw new Error(`550 mailbox unavailable: ${message.to}`);
    this.sent.push(message);
    return { messageId: `fake-${this.sent.length}` };
  }
}
