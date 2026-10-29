import { AppError } from "../../lib/errors.js";
import type { SocietyAuthContext } from "../../middleware/require-society.js";
import type { ReportsRepository } from "./reports.repository.js";
import type { CreateReportInput, ListReportsQuery } from "./reports.schemas.js";
import type { ReportRecord, ReportSummaryRecord } from "./reports.types.js";

export interface ReportsService {
  create(auth: SocietyAuthContext, input: CreateReportInput): Promise<ReportRecord>;
  list(auth: SocietyAuthContext, query: ListReportsQuery): Promise<{ items: ReportSummaryRecord[]; total: number }>;
  get(auth: SocietyAuthContext, reportId: string): Promise<ReportRecord>;
}

/**
 * Phase 3: fields only. Phase 4 adds the photo upload before the insert, and Phase 5 the
 * notification row + email after it (docs/ARCHITECTURE.md §6).
 */
export function createReportsService({ repository }: { repository: ReportsRepository }): ReportsService {
  return {
    // society_id and created_by_id come from the session, never from the request.
    create: (auth, input) => repository.create({ ...input, societyId: auth.societyId, createdById: auth.userId }),

    list: (auth, { mine, ...query }) =>
      repository.list(auth.societyId, { ...query, ...(mine ? { createdById: auth.userId } : {}) }),

    async get(auth, reportId) {
      const report = await repository.findById(auth.societyId, reportId);
      if (!report) throw new AppError(404, "NOT_FOUND", "Report not found");
      return report;
    },
  };
}
