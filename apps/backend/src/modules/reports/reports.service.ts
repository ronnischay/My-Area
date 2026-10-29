import { randomUUID } from "node:crypto";
import type { BackgroundTasks } from "../../lib/background-tasks.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import type { SocietyAuthContext } from "../../middleware/require-society.js";
import type { MediaStorage } from "../../providers/media-storage.js";
import type { PreparedPhoto } from "../media/media.validation.js";
import { mediaUrl } from "../media/media.urls.js";
import type { NotificationsService } from "../notifications/notifications.service.js";
import type { ReportsRepository } from "./reports.repository.js";
import type { CreateReportInput, ListReportsQuery } from "./reports.schemas.js";
import type { ReportRecord, ReportSummaryRecord } from "./reports.types.js";

export interface ReportsService {
  create(auth: SocietyAuthContext, input: CreateReportInput, photo: PreparedPhoto): Promise<ReportRecord>;
  list(auth: SocietyAuthContext, query: ListReportsQuery): Promise<{ items: ReportSummaryRecord[]; total: number }>;
  get(auth: SocietyAuthContext, reportId: string): Promise<ReportRecord>;
}

export interface ReportsServiceDeps {
  repository: ReportsRepository;
  storage: MediaStorage;
  notifications: NotificationsService;
  backgroundTasks: BackgroundTasks;
  logger: Logger;
}

/**
 * Create = store the (already checked) photo → one DB transaction for report + photo row → on DB
 * failure delete the stored file → after commit, email the managers in the background (D022), so the
 * resident gets the response without waiting for the mail server (docs/ARCHITECTURE.md §6).
 */
export function createReportsService({ repository, storage, notifications, backgroundTasks, logger }: ReportsServiceDeps): ReportsService {
  return {
    async create(auth, input, photo) {
      const mediaId = randomUUID();
      const key = `reports/${mediaId}.${photo.extension}`;

      try {
        await storage.save(key, photo.bytes);
      } catch (err) {
        logger.error("photo storage failed", { err });
        throw new AppError(502, "MEDIA_UPLOAD_FAILED", "We couldn't save your photo, so nothing was submitted. Please try again.");
      }

      let report: ReportRecord;
      try {
        // society_id and created_by_id come from the session, never from the request.
        report = await repository.create({
          ...input,
          societyId: auth.societyId,
          createdById: auth.userId,
          photo: {
            id: mediaId,
            mediaType: "IMAGE",
            url: mediaUrl(mediaId),
            providerPublicId: key,
            mimeType: photo.mimeType,
            sizeBytes: photo.sizeBytes,
            width: photo.width,
            height: photo.height,
            originalFilename: photo.originalFilename,
          },
        });
      } catch (err) {
        await storage.delete(key).catch((cleanupErr: unknown) => {
          logger.error("orphaned photo after failed report insert", { key, err: cleanupErr });
        });
        throw err;
      }

      backgroundTasks.run("new-report email", () => notifications.newReport(auth.societyId, report));
      return report;
    },

    list: (auth, { mine, ...query }) =>
      repository.list(auth.societyId, { ...query, ...(mine ? { createdById: auth.userId } : {}) }),

    async get(auth, reportId) {
      const report = await repository.findById(auth.societyId, reportId);
      if (!report) throw new AppError(404, "NOT_FOUND", "Report not found");
      return report;
    },
  };
}
