import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { reportCategory, reportStatus } from "./enums.js";
import { societies } from "./societies.js";
import { users } from "./users.js";

// docs/DATABASE.md §4.5. society_id and created_by_id always come from the session.
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    societyId: uuid("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "restrict" }),
    createdById: uuid("created_by_id").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    category: reportCategory("category").notNull(),
    locationText: varchar("location_text", { length: 255 }).notNull(),
    status: reportStatus("status").notNull().default("OPEN"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The reporter must belong to the report's society (targets users_society_id_id_uq).
    foreignKey({
      name: "reports_created_by_same_society_fk",
      columns: [t.societyId, t.createdById],
      foreignColumns: [users.societyId, users.id],
    }).onDelete("restrict"),
    index("reports_society_id_status_created_at_idx").on(t.societyId, t.status, t.createdAt.desc()),
    index("reports_society_id_created_at_idx").on(t.societyId, t.createdAt.desc()),
    index("reports_created_by_id_idx").on(t.createdById),
    check("reports_resolved_at_ck", sql`(${t.status} = 'RESOLVED') = (${t.resolvedAt} IS NOT NULL)`),
  ],
);
