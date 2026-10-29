import { z } from "zod";
import { PaginationQuerySchema } from "../../lib/pagination.js";
import { REPORT_CATEGORIES, REPORT_STATUSES } from "./reports.types.js";

/** Limits from docs/API_CONTRACT.md POST /api/reports; the frontend mirrors them. */
export const CreateReportBodySchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120, "Title must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be at most 2000 characters"),
  category: z.enum(REPORT_CATEGORIES, "Choose a category"),
  locationText: z
    .string()
    .trim()
    .min(5, "Location must be at least 5 characters")
    .max(255, "Location must be at most 255 characters"),
});

export const ListReportsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
  category: z.enum(REPORT_CATEGORIES).optional(),
  mine: z
    .enum(["true", "false"], "Use true or false")
    .optional()
    .transform((mine) => mine === "true"),
  q: z
    .string()
    .trim()
    .max(100, "Search is too long")
    .optional()
    .transform((q) => q || undefined),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export type CreateReportInput = z.output<typeof CreateReportBodySchema>;
export type ListReportsQuery = z.output<typeof ListReportsQuerySchema>;
