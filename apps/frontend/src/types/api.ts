/**
 * Mirrored API contract types — source of truth: docs/API_CONTRACT.md.
 * There is no shared package yet (docs/DECISIONS.md D003); when the contract changes,
 * update the backend, API_CONTRACT.md and this file in the same change.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "SOCIETY_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "ALREADY_VOTED"
  | "VOTING_CLOSED"
  | "EMAIL_TAKEN"
  | "SOCIETY_ALREADY_EXISTS"
  | "USER_NOT_INVITED"
  | "INVITE_INVALID"
  | "FILE_TOO_LARGE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "MEDIA_UPLOAD_FAILED"
  | "SUGGESTIONS_UNAVAILABLE"
  | "SUGGESTION_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: { fieldErrors?: Record<string, string[]> } & Record<string, unknown>;
    requestId?: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: Pagination;
}

export interface HealthResponse {
  status: "ok";
}

// --- Auth, societies and members (Phase 2) -----------------------------------

export type UserRole = "ADMIN" | "MANAGER" | "RESIDENT";
export type UserStatus = "INVITED" | "ACTIVE" | "DISABLED";
/** Roles an admin can give when inviting or editing a member. */
export type MemberRole = Exclude<UserRole, "ADMIN">;

export interface Society {
  id: string;
  name: string;
  addressText: string;
  createdAt: string;
}

/** GET /api/auth/me, and the body of a successful login or invite acceptance. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** null only for an ADMIN before society setup. */
  society: Society | null;
}

/** POST /api/auth/invites/lookup */
export interface InviteDetails {
  name: string;
  email: string;
  role: UserRole;
  societyName: string;
  expiresAt: string;
}

/** Admin member list item (GET /api/admin/users). */
export interface SocietyMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** Set while status is INVITED. */
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Whether the invite email went out. The member is saved either way. */
export type InviteDelivery = "SENT" | "FAILED";

export interface InviteResponse {
  data: SocietyMember;
  meta: { invite: InviteDelivery };
}

// --- Reports (Phase 3) --------------------------------------------------------

export type ReportCategory =
  | "ROADS"
  | "STREETLIGHTS"
  | "WASTE"
  | "WATER_DRAINAGE"
  | "PARKS"
  | "NOISE"
  | "SAFETY"
  | "OTHER";
export type ReportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

export interface UserRef {
  id: string;
  name: string;
}

export interface ReportMedia {
  id: string;
  purpose: "SUBMISSION" | "RESOLUTION";
  mediaType: "IMAGE" | "VIDEO";
  /** Same-origin path `/api/media/:id`; needs the session cookie (only the report's society can load it). */
  url: string;
  mimeType: string;
  createdAt: string;
}

/** One status change, oldest first in `Report.statusHistory`. Visible to every member. */
export interface StatusHistoryEntry {
  id: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  changedBy: UserRef;
  createdAt: string;
}

/** GET /api/reports/:id and POST /api/reports. */
export interface Report {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  media: ReportMedia[];
  /** The caller created it. */
  isMine: boolean;
  /** Set for MANAGER/ADMIN callers and for the author; null for other residents. */
  createdBy: UserRef | null;
  /** Thumbs-up count. */
  voteCount: number;
  /** The caller has given a thumbs-up. */
  hasVoted: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryEntry[];
}

/** GET /api/reports list item. */
export interface ReportSummary {
  id: string;
  title: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  thumbnailUrl: string | null;
  isMine: boolean;
  voteCount: number;
  createdAt: string;
}

/** POST/DELETE /api/reports/:id/votes. */
export interface VoteState {
  voteCount: number;
  hasVoted: boolean;
}

/**
 * POST /api/reports text fields. Send as `multipart/form-data` together with one `photo` file
 * (image/jpeg, image/png or image/webp, at most 5 MB).
 */
export interface CreateReportInput {
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
}

/** GET /api/features: optional features this server has switched on. */
export interface Features {
  aiSuggestions: boolean;
}

/** POST /api/reports/suggest ("Autofill with AI"): filled into the form, with Undo. */
export interface ReportSuggestion {
  title: string;
  category: ReportCategory;
  description: string;
}

/** GET /api/management/stats (MANAGER, ADMIN). */
export interface ManagementStats {
  byStatus: Record<ReportStatus, number>;
}

/** PATCH /api/reports/:id/status body. */
export interface UpdateStatusInput {
  status: ReportStatus;
  note?: string;
}

export interface ReportListQuery {
  page?: number;
  pageSize?: number;
  status?: ReportStatus;
  category?: ReportCategory;
  mine?: boolean;
  q?: string;
  sort?: "newest" | "oldest";
}
