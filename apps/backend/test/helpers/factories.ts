import { createPasswordHasher } from "../../src/lib/password.js";
import { hashToken, newToken } from "../../src/lib/tokens.js";
import { INVITE_TTL_MS, SESSION_COOKIE, SESSION_TTL_MS } from "../../src/modules/auth/auth.constants.js";
import type { UserRole, UserStatus } from "../../src/modules/users/users.types.js";
import type { InMemoryStore, ReportMediaRow, ReportRow, SocietyRow, UserRow } from "./fakes.js";

/** Real scrypt with a tiny cost so tests stay fast. Hashes are still verifiable by the default hasher. */
export const fastPasswordHasher = createPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });

export const TEST_PASSWORD = "correct horse battery";

export function addSociety(store: InMemoryStore, overrides: Partial<SocietyRow> = {}): SocietyRow {
  const society: SocietyRow = {
    id: store.newId(),
    name: "Green Park Residency",
    addressText: "Plot 12, Sector 45, Gurugram",
    createdAt: store.nextCreatedAt(),
    ...overrides,
  };
  store.societies.set(society.id, society);
  return society;
}

export async function addUser(
  store: InMemoryStore,
  options: {
    role?: UserRole;
    status?: UserStatus;
    societyId?: string | null;
    email?: string;
    name?: string;
    password?: string | null;
    invitedById?: string | null;
  } = {},
): Promise<UserRow> {
  const status = options.status ?? "ACTIVE";
  const password = options.password === undefined ? (status === "INVITED" ? null : TEST_PASSWORD) : options.password;
  const id = store.newId();
  const user: UserRow = {
    id,
    societyId: options.societyId ?? null,
    email: options.email ?? `user-${id.slice(0, 8)}@example.com`,
    name: options.name ?? "Meera Iyer",
    role: options.role ?? "RESIDENT",
    status,
    passwordHash: password ? await fastPasswordHasher.hash(password) : null,
    invitedById: options.invitedById ?? null,
    lastLoginAt: null,
    createdAt: store.nextCreatedAt(),
  };
  store.users.set(user.id, user);
  return user;
}

/** Puts a live session in the store and returns the Cookie header value for it. */
export function sessionCookie(store: InMemoryStore, userId: string, now: Date): string {
  const token = newToken();
  store.sessions.set(hashToken(token), { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + SESSION_TTL_MS) });
  return `${SESSION_COOKIE}=${token}`;
}

/** Puts a live invite in the store and returns the raw token (what the email link carries). */
export function inviteToken(store: InMemoryStore, userId: string, now: Date, ttlMs = INVITE_TTL_MS): string {
  const token = newToken();
  store.invites.set(userId, { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMs) });
  return token;
}

/** A report in `societyId` by `createdById`. Pass `status: "RESOLVED"` with a `resolvedAt`, like the DB check requires. */
export function addReport(
  store: InMemoryStore,
  options: Pick<ReportRow, "societyId" | "createdById"> & Partial<ReportRow>,
): ReportRow {
  const createdAt = store.nextCreatedAt();
  const report: ReportRow = {
    id: store.newId(),
    title: "Streetlight out near Block C",
    description: "The streetlight opposite Block C gate has been off for three nights.",
    category: "STREETLIGHTS",
    locationText: "Block C main gate",
    status: "OPEN",
    resolvedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...options,
  };
  store.reports.set(report.id, report);
  return report;
}

/** A photo row for `reportId`. The file itself is not stored; put bytes in FakeMediaStorage if a test reads it. */
export function addReportMedia(
  store: InMemoryStore,
  options: Pick<ReportMediaRow, "reportId"> & Partial<ReportMediaRow>,
): ReportMediaRow {
  const id = store.newId();
  const media: ReportMediaRow = {
    id,
    providerPublicId: `reports/${id}.jpg`,
    purpose: "SUBMISSION",
    mediaType: "IMAGE",
    url: `/api/media/${id}`,
    mimeType: "image/jpeg",
    createdAt: store.nextCreatedAt(),
    ...options,
  };
  store.reportMedia.set(media.id, media);
  return media;
}
