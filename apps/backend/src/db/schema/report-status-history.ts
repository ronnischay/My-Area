import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { reportStatus } from "./enums.js";
import { reports } from "./reports.js";
import { users } from "./users.js";

// docs/DATABASE.md §4.8. Written in the same transaction as the status change.
export const reportStatusHistory = pgTable(
  "report_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    fromStatus: reportStatus("from_status").notNull(),
    toStatus: reportStatus("to_status").notNull(),
    // Shown to residents on the report page.
    note: varchar("note", { length: 1000 }),
    changedById: uuid("changed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("report_status_history_report_id_created_at_idx").on(t.reportId, t.createdAt),
    check("report_status_history_changed_ck", sql`${t.fromStatus} <> ${t.toStatus}`),
  ],
);
