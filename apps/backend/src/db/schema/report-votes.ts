import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { reports } from "./reports.js";
import { users } from "./users.js";

// docs/DATABASE.md §4.9. A thumbs-up: "this affects me too". The primary key makes it one per person per report.
export const reportVotes = pgTable(
  "report_votes",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ name: "report_votes_pkey", columns: [t.reportId, t.voterId] }), index("report_votes_voter_id_idx").on(t.voterId)],
);
