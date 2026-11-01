import type { Logger } from "../../lib/logger.js";
import type { EmailSender } from "../../providers/email.provider.js";
import type { ReportRecord } from "../reports/reports.types.js";
import type { NotificationsRepository, Recipient } from "./notifications.repository.js";
import { newReportEmail } from "./templates/new-report.js";

export interface NotificationsService {
  /** Emails the society's managers about a saved report. Never throws for a failed send; logs it. */
  newReport(societyId: string, report: ReportRecord): Promise<void>;
}

export interface NotificationsServiceDeps {
  repository: NotificationsRepository;
  emailSender: EmailSender;
  logger: Logger;
  /** Public frontend URL; report links are `${appUrl}/reports/<id>`. */
  appUrl: string;
}

/**
 * D022, D028: every ACTIVE manager of the report's society (no admin fallback: admins belong to none).
 * The reporter is never emailed about their own report.
 */
export function chooseRecipients(managers: Recipient[], reporterId: string): Recipient[] {
  return managers.filter((manager) => manager.id !== reporterId);
}

export function createNotificationsService({ repository, emailSender, logger, appUrl }: NotificationsServiceDeps): NotificationsService {
  return {
    async newReport(societyId, report) {
      const society = await repository.findSocietyManagers(societyId);
      if (!society) throw new Error("society not found for new-report email");

      const recipients = chooseRecipients(society.managers, report.createdBy.id);
      if (recipients.length === 0) {
        logger.warn("new-report email not sent: no active manager to notify", { reportId: report.id });
        return;
      }

      const link = `${appUrl}/reports/${report.id}`;
      // One email per person, so addresses aren't shared; one failure doesn't stop the others.
      for (const recipient of recipients) {
        const content = newReportEmail({
          recipientName: recipient.name,
          societyName: society.societyName,
          reporterName: report.createdBy.name,
          title: report.title,
          description: report.description,
          category: report.category,
          locationText: report.locationText,
          createdAt: report.createdAt,
          link,
        });
        try {
          await emailSender.send({ to: recipient.email, ...content });
        } catch (err) {
          logger.warn("new-report email failed", { reportId: report.id, userId: recipient.id, err });
        }
      }
    },
  };
}
