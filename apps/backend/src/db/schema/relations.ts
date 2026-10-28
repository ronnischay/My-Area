import { relations } from "drizzle-orm";
import { sessions } from "./sessions.js";
import { societies } from "./societies.js";
import { userInvites } from "./user-invites.js";
import { users } from "./users.js";

export const societiesRelations = relations(societies, ({ many }) => ({
  members: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  society: one(societies, { fields: [users.societyId], references: [societies.id] }),
  sessions: many(sessions),
  invite: one(userInvites),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userInvitesRelations = relations(userInvites, ({ one }) => ({
  user: one(users, { fields: [userInvites.userId], references: [users.id] }),
}));
