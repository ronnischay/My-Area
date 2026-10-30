import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { mediaPurpose, mediaType } from "./enums.js";
import { reports } from "./reports.js";
import { users } from "./users.js";

// docs/DATABASE.md §4.6. Where a photo is and what type it is; the bytes live in media storage.
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
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("report_media_report_id_idx").on(t.reportId),
    uniqueIndex("report_media_provider_public_id_uq").on(t.providerPublicId),
  ],
);
