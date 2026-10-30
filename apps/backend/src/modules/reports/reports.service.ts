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
import type { Clock } from "../../lib/clock.js";
import type { CreateReportInput, ListReportsQuery, UpdateStatusInput } from "./reports.schemas.js";
import type { ReportMediaRecord, ReportRecord, ReportStatus, ReportSummaryRecord, VoteStateDto } from "./reports.types.js";
import { canTransition } from "./status-transitions.js";

export interface ReportsService {
  create(auth: SocietyAuthContext, input: CreateReportInput, photo: PreparedPhoto): Promise<ReportRecord>;
  list(auth: SocietyAuthContext, query: ListReportsQuery): Promise<{ items: ReportSummaryRecord[]; total: number }>;
  get(auth: SocietyAuthContext, reportId: string): Promise<ReportRecord>;
  /** MANAGER/ADMIN (enforced by the route). 404 unknown / other society, 409 not an allowed transition. */
  changeStatus(auth: SocietyAuthContext, reportId: string, input: UpdateStatusInput): Promise<ReportRecord>;
  /** MANAGER/ADMIN: evidence that the problem was fixed. */
  addResolutionPhoto(auth: SocietyAuthContext, reportId: string, photo: PreparedPhoto): Promise<ReportMediaRecord>;
  countByStatus(auth: SocietyAuthContext): Promise<Record<ReportStatus, number>>;
  /** Thumbs-up: any member, not on their own report, only while the report is OPEN or IN_PROGRESS. */
  vote(auth: SocietyAuthContext, reportId: string): Promise<VoteStateDto>;
  unvote(auth: SocietyAuthContext, reportId: string): Promise<VoteStateDto>;
}

const VOTABLE: readonly ReportStatus[] = ["OPEN", "IN_PROGRESS"];

export interface ReportsServiceDeps {
  repository: ReportsRepository;
  storage: MediaStorage;
  notifications: NotificationsService;
  backgroundTasks: BackgroundTasks;
  logger: Logger;
  clock: Clock;
}

const STATUS_WORDS: Record<ReportStatus, string> = { OPEN: "open", IN_PROGRESS: "in progress", RESOLVED: "resolved", REJECTED: "rejected" };
const label = (status: ReportStatus) => STATUS_WORDS[status];

const notFound = () => new AppError(404, "NOT_FOUND", "Report not found");

/**
 * Create = store the (already checked) photo → one DB transaction for report + photo row → on DB
 * failure delete the stored file → after commit, email the managers in the background (D022), so the
 * resident gets the response without waiting for the mail server (docs/ARCHITECTURE.md §6).
 */
export function createReportsService({ repository, storage, notifications, backgroundTasks, logger, clock }: ReportsServiceDeps): ReportsService {
  /** Store a checked photo; storage failure → 502 with nothing saved. Returns its id, key and row data. */
  const storePhoto = async (photo: PreparedPhoto) => {
    const id = randomUUID();
    const key = `reports/${id}.${photo.extension}`;
    try {
      await storage.save(key, photo.bytes);
    } catch (err) {
      logger.error("photo storage failed", { err });
      throw new AppError(502, "MEDIA_UPLOAD_FAILED", "We couldn't save your photo, so nothing was submitted. Please try again.");
    }
    const media = {
      id,
      mediaType: "IMAGE" as const,
      url: mediaUrl(id),
      providerPublicId: key,
      mimeType: photo.mimeType,
    };
    const discard = () =>
      storage.delete(key).catch((cleanupErr: unknown) => {
        logger.error("orphaned photo after failed report insert", { key, err: cleanupErr });
      });
    return { media, discard };
  };

  /** The report in the caller's society (404 otherwise) that still accepts thumbs-up changes (409 otherwise). */
  const votableReport = async (auth: SocietyAuthContext, reportId: string) => {
    const report = await repository.findById(auth.societyId, reportId, auth.userId);
    if (!report) throw notFound();
    if (!VOTABLE.includes(report.status)) {
      throw new AppError(409, "VOTING_CLOSED", "This report is closed, so thumbs-up can't change any more.");
    }
    return report;
  };

  return {
    async create(auth, input, photo) {
      const { media, discard } = await storePhoto(photo);
      let report: ReportRecord;
      try {
        // society_id and created_by_id come from the session, never from the request.
        report = await repository.create({ ...input, societyId: auth.societyId, createdById: auth.userId, photo: media });
      } catch (err) {
        await discard();
        throw err;
      }

      backgroundTasks.run("new-report email", () => notifications.newReport(auth.societyId, report));
      return report;
    },

    list: (auth, { mine, ...query }) =>
      repository.list(auth.societyId, { ...query, ...(mine ? { createdById: auth.userId } : {}) }),

    async get(auth, reportId) {
      const report = await repository.findById(auth.societyId, reportId, auth.userId);
      if (!report) throw notFound();
      return report;
    },

    async changeStatus(auth, reportId, { status, note }) {
      const result = await repository.changeStatus({
        societyId: auth.societyId,
        reportId,
        to: status,
        note,
        changedById: auth.userId,
        at: clock(),
        isAllowed: canTransition,
      });
      if (result.outcome === "NOT_FOUND") throw notFound();
      if (result.outcome === "REFUSED") {
        throw new AppError(409, "INVALID_STATUS_TRANSITION", `A report that is ${label(result.from)} can't be changed to ${label(status)}.`, {
          from: result.from,
          to: status,
        });
      }
      return result.report;
    },

    async addResolutionPhoto(auth, reportId, photo) {
      // Checked first so a photo for a missing report is never written.
      if (!(await repository.findById(auth.societyId, reportId))) throw notFound();
      const { media, discard } = await storePhoto(photo);
      let row: ReportMediaRecord | null;
      try {
        row = await repository.addResolutionMedia(auth.societyId, reportId, { ...media, uploadedById: auth.userId });
      } catch (err) {
        await discard();
        throw err;
      }
      if (!row) {
        await discard();
        throw notFound();
      }
      return row;
    },

    countByStatus: (auth) => repository.countByStatus(auth.societyId),

    async vote(auth, reportId) {
      const report = await votableReport(auth, reportId);
      if (report.createdBy.id === auth.userId) throw new AppError(403, "FORBIDDEN", "You can't give a thumbs-up to your own report.");
      if ((await repository.addVote(reportId, auth.userId)) === "DUPLICATE") {
        throw new AppError(409, "ALREADY_VOTED", "You've already given this report a thumbs-up.");
      }
      return { voteCount: report.voteCount + 1, hasVoted: true };
    },

    async unvote(auth, reportId) {
      const report = await votableReport(auth, reportId);
      const removed = await repository.removeVote(reportId, auth.userId);
      return { voteCount: report.voteCount - (removed ? 1 : 0), hasVoted: false };
    },
  };
}
