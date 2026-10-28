import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import { hashToken, newToken } from "../../lib/tokens.js";
import type { SocietyAuthContext } from "../../middleware/require-society.js";
import type { EmailSender } from "../../providers/email.provider.js";
import { INVITE_TTL_MS } from "../auth/auth.constants.js";
import { inviteEmail } from "./templates/invite.js";
import type { MemberListQuery, UsersRepository } from "./users.repository.js";
import type { InviteDelivery, MemberRecord, MemberRole, UserStatus } from "./users.types.js";

export interface InviteResult {
  member: MemberRecord;
  invite: InviteDelivery;
}

export interface UsersService {
  list(societyId: string, query: MemberListQuery): Promise<{ items: MemberRecord[]; total: number }>;
  invite(admin: SocietyAuthContext, input: { name: string; email: string; role: MemberRole }): Promise<InviteResult>;
  resendInvite(admin: SocietyAuthContext, userId: string): Promise<InviteResult>;
  update(admin: SocietyAuthContext, userId: string, patch: { role?: MemberRole; disabled?: boolean }): Promise<MemberRecord>;
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

export function createUsersService({ repository, emailSender, logger, clock, appUrl }: UsersServiceDeps): UsersService {
  const newInvite = () => {
    const token = newToken();
    return { token, tokenHash: hashToken(token), expiresAt: new Date(clock().getTime() + INVITE_TTL_MS) };
  };

  /** Sent after the data is committed. A failure is reported, never thrown: the member stays saved. */
  const sendInvite = async (adminId: string, member: MemberRecord, token: string, expiresAt: Date): Promise<InviteDelivery> => {
    try {
      const inviter = await repository.findInviter(adminId);
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

  /** Admins manage members, not themselves or other admins (docs/API_CONTRACT.md PATCH /api/admin/users/:id). */
  const findEditableMember = async (admin: SocietyAuthContext, userId: string) => {
    if (userId === admin.userId) throw new AppError(403, "FORBIDDEN", "You can't change your own account here.");
    const member = await repository.findMember(admin.societyId, userId);
    if (!member) throw notFound();
    if (member.role === "ADMIN") throw new AppError(403, "FORBIDDEN", "Admins can't be changed here.");
    return member;
  };

  return {
    list: (societyId, query) => repository.list(societyId, query),

    async invite(admin, { name, email, role }) {
      const { token, tokenHash, expiresAt } = newInvite();
      const member = await repository.createInvitedMember({
        societyId: admin.societyId,
        invitedById: admin.userId,
        name,
        email,
        role,
        invite: { tokenHash, expiresAt },
      });
      if (member === "EMAIL_TAKEN") {
        throw new AppError(409, "EMAIL_TAKEN", "This email already has a MyArea account.", {
          fieldErrors: { email: ["This email already has a MyArea account."] },
        });
      }
      return { member, invite: await sendInvite(admin.userId, member, token, expiresAt) };
    },

    async resendInvite(admin, userId) {
      const member = await findEditableMember(admin, userId);
      if (member.status !== "INVITED") {
        throw new AppError(409, "USER_NOT_INVITED", "Only members who haven't joined yet can get a new invite.");
      }
      const { token, tokenHash, expiresAt } = newInvite();
      await repository.replaceInvite(member.id, { tokenHash, expiresAt });
      const updated = { ...member, inviteExpiresAt: expiresAt };
      return { member: updated, invite: await sendInvite(admin.userId, updated, token, expiresAt) };
    },

    async update(admin, userId, { role, disabled }) {
      const member = await findEditableMember(admin, userId);

      let status: UserStatus | undefined;
      if (disabled === true) status = "DISABLED";
      // Re-enabled members who never set a password go back to INVITED (the admin resends the invite).
      if (disabled === false && member.status === "DISABLED") status = member.hasPassword ? "ACTIVE" : "INVITED";

      const updated = await repository.updateMember(admin.societyId, userId, {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      });
      if (!updated) throw notFound();
      return updated;
    },
  };
}
