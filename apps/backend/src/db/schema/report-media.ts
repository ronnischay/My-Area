import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { mediaPurpose, mediaType } from "./enums.js";
import { reports } from "./reports.js";
import { users } from "./users.js";

// docs/DATABASE.md §4.6. Metadata only; the bytes live in Cloudinary. Filled from Phase 4.
export const reportMedia = pgTable(
  "report_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    purpose: mediaPurpose("purpose").notNull().default("SUBMISSION"),
    mediaType: mediaType("media_type").notNull(),
    url: text("url").notNull(),
    providerPublicId: varchar("provider_public_id", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // Pixel size from the provider, so the UI can reserve space before the image loads.
    width: integer("width"),
    height: integer("height"),
    originalFilename: varchar("original_filename", { length: 255 }),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("report_media_report_id_idx").on(t.reportId),
    uniqueIndex("report_media_provider_public_id_uq").on(t.providerPublicId),
    check("report_media_size_bytes_ck", sql`${t.sizeBytes} > 0`),
    check(
      "report_media_dimensions_ck",
      sql`(${t.width} IS NULL OR ${t.width} > 0) AND (${t.height} IS NULL OR ${t.height} > 0)`,
    ),
  ],
);
