import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// docs/DATABASE.md §4.1
export const societies = pgTable("societies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  addressText: varchar("address_text", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
