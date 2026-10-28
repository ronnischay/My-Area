import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { userRole, userStatus } from "./enums.js";
import { societies } from "./societies.js";

// docs/DATABASE.md §4.2. Users are never hard-deleted; they are DISABLED.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null only for an ADMIN who has not created a society yet (users_society_required_ck).
    societyId: uuid("society_id").references(() => societies.id, { onDelete: "restrict" }),
    // Stored trimmed + lower-cased by the services.
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    role: userRole("role").notNull(),
    status: userStatus("status").notNull().default("INVITED"),
    passwordHash: varchar("password_hash", { length: 255 }),
    invitedById: uuid("invited_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_society_id_role_idx").on(t.societyId, t.role),
    check("users_society_required_ck", sql`${t.role} = 'ADMIN' OR ${t.societyId} IS NOT NULL`),
    check("users_active_has_password_ck", sql`${t.status} <> 'ACTIVE' OR ${t.passwordHash} IS NOT NULL`),
  ],
);
