import type { BadgeTone } from "@/components/ui/Badge";
import type { ReportCategory, ReportStatus } from "@/types/api";

/** Display order is fixed and OTHER is last (UI_UX_GUIDELINES §6). Labels live in the frontend only. */
export const CATEGORIES: readonly { value: ReportCategory; label: string }[] = [
  { value: "ROADS", label: "Roads" },
  { value: "STREETLIGHTS", label: "Streetlights" },
  { value: "WASTE", label: "Waste" },
  { value: "WATER_DRAINAGE", label: "Water & drainage" },
  { value: "PARKS", label: "Parks" },
  { value: "NOISE", label: "Noise" },
  { value: "SAFETY", label: "Safety" },
  { value: "OTHER", label: "Other" },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<ReportCategory, string>;

/** Status colour is never the only signal: every badge carries its label (UI_UX_GUIDELINES §2). */
export const STATUSES: readonly { value: ReportStatus; label: string; tone: BadgeTone }[] = [
  { value: "OPEN", label: "Open", tone: "info" },
  { value: "IN_PROGRESS", label: "In progress", tone: "warning" },
  { value: "RESOLVED", label: "Resolved", tone: "success" },
  { value: "REJECTED", label: "Rejected", tone: "neutral" },
];

export const STATUS_META = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as Record<ReportStatus, (typeof STATUSES)[number]>;

export function isCategory(value: unknown): value is ReportCategory {
  return CATEGORIES.some((c) => c.value === value);
}

export function isStatus(value: unknown): value is ReportStatus {
  return STATUSES.some((s) => s.value === value);
}

/** Mirrors the API's transition map (backend status-transitions.ts). RESOLVED and REJECTED are final. */
export const STATUS_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  OPEN: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "REJECTED", "OPEN"],
  RESOLVED: [],
  REJECTED: [],
};

/** Limits mirror POST /api/reports (docs/API_CONTRACT.md). */
export const REPORT_LIMITS = {
  title: { min: 5, max: 120 },
  description: { min: 10, max: 2000 },
  locationText: { min: 5, max: 255 },
  photoBytes: 5 * 1024 * 1024,
  photoTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
