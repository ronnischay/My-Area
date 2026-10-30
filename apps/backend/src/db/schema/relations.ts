import { relations } from "drizzle-orm";
import { reportMedia } from "./report-media.js";
import { reportStatusHistory } from "./report-status-history.js";
import { reportVotes } from "./report-votes.js";
import { reports } from "./reports.js";
import { sessions } from "./sessions.js";
import { societies } from "./societies.js";
import { userInvites } from "./user-invites.js";
import { users } from "./users.js";

export const societiesRelations = relations(societies, ({ many }) => ({
  members: many(users),
  reports: many(reports),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  society: one(societies, { fields: [users.societyId], references: [societies.id] }),
  sessions: many(sessions),
  invite: one(userInvites),
  reports: many(reports),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userInvitesRelations = relations(userInvites, ({ one }) => ({
  user: one(users, { fields: [userInvites.userId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  society: one(societies, { fields: [reports.societyId], references: [societies.id] }),
  createdBy: one(users, { fields: [reports.createdById], references: [users.id] }),
  media: many(reportMedia),
  statusHistory: many(reportStatusHistory),
  votes: many(reportVotes),
}));

export const reportMediaRelations = relations(reportMedia, ({ one }) => ({
  report: one(reports, { fields: [reportMedia.reportId], references: [reports.id] }),
  uploadedBy: one(users, { fields: [reportMedia.uploadedById], references: [users.id] }),
}));

export const reportStatusHistoryRelations = relations(reportStatusHistory, ({ one }) => ({
  report: one(reports, { fields: [reportStatusHistory.reportId], references: [reports.id] }),
  changedBy: one(users, { fields: [reportStatusHistory.changedById], references: [users.id] }),
}));

export const reportVotesRelations = relations(reportVotes, ({ one }) => ({
  report: one(reports, { fields: [reportVotes.reportId], references: [reports.id] }),
  voter: one(users, { fields: [reportVotes.voterId], references: [users.id] }),
}));
