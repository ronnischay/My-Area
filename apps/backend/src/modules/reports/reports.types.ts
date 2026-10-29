import type { UserRole } from "../users/users.types.js";

/** Mirrors docs/API_CONTRACT.md §2 and DATABASE.md §3. Kept free of Drizzle so services can import it. */

export const REPORT_CATEGORIES = [
  "ROADS",
  "STREETLIGHTS",
  "WASTE",
  "WATER_DRAINAGE",
  "PARKS",
  "NOISE",
  "SAFETY",
  "OTHER",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_PURPOSES = ["SUBMISSION", "RESOLUTION"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export interface UserRef {
  id: string;
  name: string;
}

export interface ReportMediaRecord {
  id: string;
  purpose: MediaPurpose;
  mediaType: MediaType;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface ReportRecord {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  createdBy: UserRef;
  media: ReportMediaRecord[];
  /** Oldest first. */
  statusHistory: StatusHistoryRecord[];
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusHistoryRecord {
  id: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  changedBy: UserRef;
  createdAt: Date;
}

/** `StatusHistoryEntry` in the API contract. */
export interface StatusHistoryDto {
  id: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string | null;
  changedBy: UserRef;
  createdAt: string;
}

export interface ReportSummaryRecord {
  id: string;
  title: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  createdById: string;
  /** First SUBMISSION photo, if any. */
  thumbnailUrl: string | null;
  createdAt: Date;
}

/** Who is asking: decides `isMine` and whether the reporter's name is shown. */
export interface ReportViewer {
  userId: string;
  role: UserRole;
}

export interface ReportMediaDto {
  id: string;
  purpose: MediaPurpose;
  mediaType: MediaType;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** `Report` (+ `statusHistory`, oldest first) in the API contract. */
export interface ReportDto {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  media: ReportMediaDto[];
  isMine: boolean;
  createdBy: UserRef | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryDto[];
}

/** `ReportSummary` in the API contract. */
export interface ReportSummaryDto {
  id: string;
  title: string;
  category: ReportCategory;
  locationText: string;
  status: ReportStatus;
  thumbnailUrl: string | null;
  isMine: boolean;
  createdAt: string;
}

export function toReportMediaDto(m: ReportMediaRecord): ReportMediaDto {
  return {
    id: m.id,
    purpose: m.purpose,
    mediaType: m.mediaType,
    url: m.url,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    width: m.width,
    height: m.height,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Managers, admins and the author see who reported; other residents don't (docs/features/reports.md §10). */
export function toReportDto(report: ReportRecord, viewer: ReportViewer): ReportDto {
  const isMine = report.createdBy.id === viewer.userId;
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    locationText: report.locationText,
    status: report.status,
    media: report.media.map(toReportMediaDto),
    isMine,
    createdBy: isMine || viewer.role !== "RESIDENT" ? report.createdBy : null,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    // Who changed the status is visible to everyone in the society: managers act in the open.
    statusHistory: report.statusHistory.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
  };
}

export function toReportSummaryDto(report: ReportSummaryRecord, viewer: ReportViewer): ReportSummaryDto {
  return {
    id: report.id,
    title: report.title,
    category: report.category,
    locationText: report.locationText,
    status: report.status,
    thumbnailUrl: report.thumbnailUrl,
    isMine: report.createdById === viewer.userId,
    createdAt: report.createdAt.toISOString(),
  };
}
