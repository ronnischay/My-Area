import type { ReportStatus } from "./reports.types.js";

/**
 * docs/DATABASE.md §3 "Report status transitions". RESOLVED and REJECTED are final in the MVP.
 * Anything not listed is refused with 409 INVALID_STATUS_TRANSITION.
 */
export const STATUS_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  OPEN: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "REJECTED", "OPEN"],
  RESOLVED: [],
  REJECTED: [],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
