import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import { hashToken, newToken } from "../../lib/tokens.js";
import type { SocietyAuthContext } from "../../middleware/require-society.js";
import type { EmailSender } from "../../providers/email.provider.js";
import { INVITE_TTL_MS } from "../auth/auth.constants.js";
import { inviteEmail } from "./templates/invite.js";
import type { EmailConflict, MemberListQuery, UsersRepository } from "./users.repository.js";
import type { InviteDelivery, MemberRecord, MemberRole, UserStatus } from "./users.types.js";

export interface InviteResult {
  member: MemberRecord;
  invite: InviteDelivery;
}

/**
 * `actor` is the signed-in admin or manager with `societyId` set to the society being worked on
 * (the route checks a manager may only use their own). Admins invite residents and managers;
 * managers invite residents only (D027, D028).
 */
export interface UsersService {
  list(societyId: string, query: MemberListQuery): Promise<{ items: MemberRecord[]; total: number }>;
  invite(actor: SocietyAuthContext, input: { name: string; email: string; role: MemberRole }): Promise<InviteResult>;
  resendInvite(actor: SocietyAuthContext, userId: string): Promise<InviteResult>;
  update(actor: SocietyAuthContext, userId: string, patch: { role?: MemberRole; disabled?: boolean }): Promise<MemberRecord>;
}

export interface UsersServiceDeps {
  repository: UsersRepository;
  emailSender: EmailSender;
  logger: Logger;
  clock: Clock;
  /** Public frontend URL; invite links are `${appUrl}/invite?token=…`. */
  appUrl: string;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Member not found");
const residentsOnly = () => new AppError(403, "FORBIDDEN", "Managers can only invite residents.");

const CONFLICTS: Record<EmailConflict, { code: "EMAIL_TAKEN" | "ALREADY_IN_SOCIETY"; message: string }> = {
  THIS_SOCIETY: { code: "EMAIL_TAKEN", message: "This person is already a member of this society." },
  OTHER_SOCIETY: { code: "ALREADY_IN_SOCIETY", message: "This person already belongs to another society. A person can be in only one society." },
  ADMIN: { code: "EMAIL_TAKEN", message: "This email belongs to an admin account." },
};

export function createUsersService({ repository, emailSender, logger, clock, appUrl }: UsersServiceDeps): UsersService {
  const newInvite = () => {
    const token = newToken();
    return { token, tokenHash: hashToken(token), expiresAt: new Date(clock().getTime() + INVITE_TTL_MS) };
  };

  /** Sent after the data is committed. A failure is reported, never thrown: the member stays saved. */
  const sendInvite = async (actor: SocietyAuthContext, member: MemberRecord, token: string, expiresAt: Date): Promise<InviteDelivery> => {
    try {
      const inviter = await repository.findInviter(actor.userId, actor.societyId);
      if (!inviter) throw new Error("inviter not found");
      const link = `${appUrl}/invite?token=${encodeURIComponent(token)}`;
      const content = inviteEmail({ memberName: member.name, inviterName: inviter.name, societyName: inviter.societyName, role: member.role, link, expiresAt });
      await emailSender.send({ to: member.email, ...content });
      return "SENT";
    } catch (err) {
      logger.warn("invite email failed", { userId: member.id, err });
      return "FAILED";
    }
  };

  /** A member of the society, never the actor themselves (docs/API_CONTRACT.md PATCH …/members/:id). */
  const findEditableMember = async (actor: SocietyAuthContext, userId: string) => {
    if (userId === actor.userId) throw new AppError(403, "FORBIDDEN", "You can't change your own account here.");
    const member = await repository.findMember(actor.societyId, userId);
    if (!member) throw notFound();
    return member;
  };

  return {
    list: (societyId, query) => repository.list(societyId, query),

    async invite(actor, { name, email, role }) {
      if (actor.role === "MANAGER" && role !== "RESIDENT") throw residentsOnly();
      const { token, tokenHash, expiresAt } = newInvite();
      const member = await repository.createInvitedMember({
        societyId: actor.societyId,
        invitedById: actor.userId,
        name,
        email,
        role,
        invite: { tokenHash, expiresAt },
      });
      if ("conflict" in member) {
        const { code, message } = CONFLICTS[member.conflict];
        throw new AppError(409, code, message, { fieldErrors: { email: [message] } });
      }
      return { member, invite: await sendInvite(actor, member, token, expiresAt) };
    },

    async resendInvite(actor, userId) {
      const member = await findEditableMember(actor, userId);
      if (actor.role === "MANAGER" && member.role !== "RESIDENT") throw residentsOnly();
      if (member.status !== "INVITED") {
        throw new AppError(409, "USER_NOT_INVITED", "Only members who haven't joined yet can get a new invite.");
      }
      const { token, tokenHash, expiresAt } = newInvite();
      await repository.replaceInvite(member.id, { tokenHash, expiresAt });
      const updated = { ...member, inviteExpiresAt: expiresAt };
      return { member: updated, invite: await sendInvite(actor, updated, token, expiresAt) };
    },

    async update(actor, userId, { role, disabled }) {
      const member = await findEditableMember(actor, userId);

      let status: UserStatus | undefined;
      if (disabled === true) status = "DISABLED";
      // Re-enabled members who never set a password go back to INVITED (the admin resends the invite).
      if (disabled === false && member.status === "DISABLED") status = member.hasPassword ? "ACTIVE" : "INVITED";

      const updated = await repository.updateMember(actor.societyId, userId, {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      });
      if (!updated) throw notFound();
      return updated;
    },
  };
}
