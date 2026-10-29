import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { containsPattern } from "../../db/like.js";
import { reportMedia, reports } from "../../db/schema/index.js";
import { offsetOf } from "../../lib/pagination.js";
import type { ReportCategory, ReportRecord, ReportStatus, ReportSummaryRecord } from "./reports.types.js";

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
}

/**
 * Every report query takes `societyId` and filters by it: there is no unscoped finder, and an id
 * from another society behaves exactly like an id that doesn't exist (docs/DATABASE.md §2).
 */
export interface ReportsRepository {
  create(input: NewReport): Promise<ReportRecord>;
  list(societyId: string, query: ReportListQuery): Promise<{ items: ReportSummaryRecord[]; total: number }>;
  findById(societyId: string, reportId: string): Promise<ReportRecord | null>;
}

export function createReportsRepository(db: Database): ReportsRepository {
  const findById = async (societyId: string, reportId: string): Promise<ReportRecord | null> => {
    const row = await db.query.reports.findFirst({
      where: and(eq(reports.id, reportId), eq(reports.societyId, societyId)),
      columns: { societyId: false, createdById: false },
      with: {
        createdBy: { columns: { id: true, name: true } },
        media: {
          columns: { reportId: false, providerPublicId: false, originalFilename: false, uploadedById: false },
          orderBy: [asc(reportMedia.createdAt), asc(reportMedia.id)],
        },
      },
    });
    return row ?? null;
  };

  return {
    findById,

    async create(input) {
      const [row] = await db.insert(reports).values(input).returning({ id: reports.id });
      if (!row) throw new Error("report insert returned no row");
      const report = await findById(input.societyId, row.id);
      if (!report) throw new Error("report not found after insert");
      return report;
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
