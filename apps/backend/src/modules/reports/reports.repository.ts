import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { containsPattern } from "../../db/like.js";
import { isUniqueViolation } from "../../db/errors.js";
import { reportMedia, reportStatusHistory, reportVotes, reports } from "../../db/schema/index.js";
import { offsetOf } from "../../lib/pagination.js";
import type { MediaType, ReportCategory, ReportMediaRecord, ReportRecord, ReportStatus, ReportSummaryRecord } from "./reports.types.js";

export interface ReportListQuery {
  status?: ReportStatus;
  category?: ReportCategory;
  /** Only reports created by this user ("mine"). */
  createdById?: string;
  q?: string;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
}

export interface NewReport {
  societyId: string;
  createdById: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  /** The resident's photo (SUBMISSION). Its file is already in MediaStorage under `providerPublicId`. */
  photo: NewReportMedia;
}

export interface NewReportMedia {
  /** Chosen by the service, because the photo URL contains it. */
  id: string;
  mediaType: MediaType;
  url: string;
  providerPublicId: string;
  mimeType: string;
}

export interface StatusChange {
  societyId: string;
  reportId: string;
  to: ReportStatus;
  note: string | null;
  changedById: string;
  at: Date;
  /** The transition rule, checked against the locked current status. May be async (tests use that to force a race). */
  isAllowed: (from: ReportStatus, to: ReportStatus) => boolean | Promise<boolean>;
}

export type StatusChangeResult = { outcome: "CHANGED"; report: ReportRecord } | { outcome: "NOT_FOUND" } | { outcome: "REFUSED"; from: ReportStatus };

/**
 * Every report query takes `societyId` and filters by it: there is no unscoped finder, and an id
 * from another society behaves exactly like an id that doesn't exist (docs/DATABASE.md §2).
 */
export interface ReportsRepository {
  /** One transaction: the report and its photo row are saved together or not at all. */
  create(input: NewReport): Promise<ReportRecord>;
  list(societyId: string, query: ReportListQuery): Promise<{ items: ReportSummaryRecord[]; total: number }>;
  /** `viewerId` decides `hasVoted` (false when omitted). */
  findById(societyId: string, reportId: string, viewerId?: string): Promise<ReportRecord | null>;
  /** "DUPLICATE" when this person already gave a thumbs-up (primary key). The caller checks the rules first. */
  addVote(reportId: string, voterId: string): Promise<"ADDED" | "DUPLICATE">;
  /** True when a vote was removed. */
  removeVote(reportId: string, voterId: string): Promise<boolean>;
  /**
   * One transaction: lock the report, check the transition against its current status, update it
   * (setting or clearing `resolved_at`) and add the history row. Two managers can't both win a race.
   */
  changeStatus(change: StatusChange): Promise<StatusChangeResult>;
  /** A RESOLUTION photo row; null when the report isn't in this society. The file is already stored. */
  addResolutionMedia(societyId: string, reportId: string, media: NewReportMedia & { uploadedById: string }): Promise<ReportMediaRecord | null>;
  /** Report counts per status for one society (zeros included). */
  countByStatus(societyId: string): Promise<Record<ReportStatus, number>>;
}

/**
 * Correlated count, so list pages stay one query. In relational-query `extras` Drizzle renders every
 * column reference with the root table's alias, so the subquery's own columns are written as plain SQL
 * on an alias (`rv`); only the outer `reports.id` goes through Drizzle.
 */
const voteCount = sql<number>`(select count(*)::int from report_votes rv where rv.report_id = ${reports.id})`;

export function createReportsRepository(db: Database): ReportsRepository {
  const findById = async (societyId: string, reportId: string, viewerId?: string): Promise<ReportRecord | null> => {
    const row = await db.query.reports.findFirst({
      where: and(eq(reports.id, reportId), eq(reports.societyId, societyId)),
      columns: { societyId: false, createdById: false },
      extras: {
        voteCount: voteCount.as("vote_count"),
        hasVoted: (viewerId
          ? sql<boolean>`exists(select 1 from report_votes rv where rv.report_id = ${reports.id} and rv.voter_id = ${viewerId})`
          : sql<boolean>`false`
        ).as("has_voted"),
      },
      with: {
        createdBy: { columns: { id: true, name: true } },
        media: {
          columns: { reportId: false, providerPublicId: false, uploadedById: false },
          orderBy: [asc(reportMedia.createdAt), asc(reportMedia.id)],
        },
        statusHistory: {
          columns: { reportId: false, changedById: false },
          with: { changedBy: { columns: { id: true, name: true } } },
          orderBy: [asc(reportStatusHistory.createdAt), asc(reportStatusHistory.id)],
        },
      },
    });
    return row ?? null;
  };

  const mediaColumns = {
    id: reportMedia.id,
    purpose: reportMedia.purpose,
    mediaType: reportMedia.mediaType,
    url: reportMedia.url,
    mimeType: reportMedia.mimeType,
    createdAt: reportMedia.createdAt,
  };

  return {
    findById,

    async create({ photo, ...input }) {
      const reportId = await db.transaction(async (tx) => {
        const [row] = await tx.insert(reports).values(input).returning({ id: reports.id });
        if (!row) throw new Error("report insert returned no row");
        await tx.insert(reportMedia).values({ ...photo, reportId: row.id, purpose: "SUBMISSION", uploadedById: input.createdById });
        return row.id;
      });
      const report = await findById(input.societyId, reportId);
      if (!report) throw new Error("report not found after insert");
      return report;
    },

    async addVote(reportId, voterId) {
      try {
        await db.insert(reportVotes).values({ reportId, voterId });
        return "ADDED";
      } catch (err) {
        if (isUniqueViolation(err, "report_votes_pkey")) return "DUPLICATE";
        throw err;
      }
    },

    async removeVote(reportId, voterId) {
      const removed = await db
        .delete(reportVotes)
        .where(and(eq(reportVotes.reportId, reportId), eq(reportVotes.voterId, voterId)))
        .returning({ reportId: reportVotes.reportId });
      return removed.length > 0;
    },

    async changeStatus({ societyId, reportId, to, note, changedById, at, isAllowed }) {
      const result = await db.transaction(async (tx): Promise<StatusChangeResult | "CHANGED"> => {
        const [current] = await tx
          .select({ status: reports.status })
          .from(reports)
          .where(and(eq(reports.id, reportId), eq(reports.societyId, societyId)))
          .for("update");
        if (!current) return { outcome: "NOT_FOUND" };
        if (!(await isAllowed(current.status, to))) return { outcome: "REFUSED", from: current.status };

        await tx
          .update(reports)
          .set({ status: to, resolvedAt: to === "RESOLVED" ? at : null })
          .where(eq(reports.id, reportId));
        await tx.insert(reportStatusHistory).values({ reportId, fromStatus: current.status, toStatus: to, note, changedById, createdAt: at });
        return "CHANGED";
      });
      if (result !== "CHANGED") return result;
      const report = await findById(societyId, reportId, changedById);
      if (!report) throw new Error("report not found after status change");
      return { outcome: "CHANGED", report };
    },

    async addResolutionMedia(societyId, reportId, { uploadedById, ...media }) {
      return db.transaction(async (tx) => {
        const [report] = await tx
          .select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.id, reportId), eq(reports.societyId, societyId)))
          .for("share");
        if (!report) return null;
        const [row] = await tx
          .insert(reportMedia)
          .values({ ...media, reportId, purpose: "RESOLUTION", uploadedById })
          .returning(mediaColumns);
        if (!row) throw new Error("media insert returned no row");
        return row;
      });
    },

    async countByStatus(societyId) {
      const rows = await db
        .select({ status: reports.status, total: count() })
        .from(reports)
        .where(eq(reports.societyId, societyId))
        .groupBy(reports.status);
      const counts: Record<ReportStatus, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, REJECTED: 0 };
      for (const row of rows) counts[row.status] = row.total;
      return counts;
    },

    async list(societyId, { status, category, createdById, q, sort, page, pageSize }) {
      const filters: SQL[] = [eq(reports.societyId, societyId)];
      if (status) filters.push(eq(reports.status, status));
      if (category) filters.push(eq(reports.category, category));
      if (createdById) filters.push(eq(reports.createdById, createdById));
      if (q) {
        const search = or(ilike(reports.title, containsPattern(q)), ilike(reports.locationText, containsPattern(q)));
        if (search) filters.push(search);
      }
      const where = and(...filters);
      const order = sort === "oldest" ? [asc(reports.createdAt), asc(reports.id)] : [desc(reports.createdAt), desc(reports.id)];

      const [items, [totals]] = await Promise.all([
        db.query.reports.findMany({
          where,
          orderBy: order,
          limit: pageSize,
          offset: offsetOf(page, pageSize),
          columns: { id: true, title: true, category: true, locationText: true, status: true, createdById: true, createdAt: true },
          extras: { voteCount: voteCount.as("vote_count") },
          with: {
            media: {
              columns: { url: true },
              where: eq(reportMedia.purpose, "SUBMISSION"),
              orderBy: [asc(reportMedia.createdAt), asc(reportMedia.id)],
              limit: 1,
            },
          },
        }),
        db.select({ total: count() }).from(reports).where(where),
      ]);
      return {
        items: items.map(({ media, ...report }) => ({ ...report, thumbnailUrl: media[0]?.url ?? null })),
        total: totals?.total ?? 0,
      };
    },
  };
}
