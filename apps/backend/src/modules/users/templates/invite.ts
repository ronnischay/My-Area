import { escapeHtml } from "../../../lib/html.js";
import type { UserRole } from "../users.types.js";

export interface InviteEmailInput {
  memberName: string;
  inviterName: string;
  societyName: string;
  role: UserRole;
  link: string;
  expiresAt: Date;
}

const ROLE_LABELS: Record<UserRole, string> = { ADMIN: "an admin", MANAGER: "a manager", RESIDENT: "a resident" };

// Recipients may be anywhere; state the timezone explicitly rather than guess theirs.
const expiryFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Plain text + simple HTML. Every user-supplied value is HTML-escaped. */
export function inviteEmail({ memberName, inviterName, societyName, role, link, expiresAt }: InviteEmailInput) {
  const expires = `${expiryFormat.format(expiresAt)} UTC`;
  const subject = `You're invited to ${societyName} on MyArea`;

  const text = [
    `Hi ${memberName},`,
    "",
    `${inviterName} has invited you to join ${societyName} on MyArea as ${ROLE_LABELS[role]}.`,
    "MyArea is where your society reports neighbourhood issues and follows them until they're fixed.",
    "",
    `Set your password and join: ${link}`,
    "",
    `This link works once and expires on ${expires}.`,
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #10201e; line-height: 1.5;">
    <p>Hi ${escapeHtml(memberName)},</p>
    <p>${escapeHtml(inviterName)} has invited you to join <strong>${escapeHtml(societyName)}</strong> on MyArea as ${ROLE_LABELS[role]}.</p>
    <p>MyArea is where your society reports neighbourhood issues and follows them until they're fixed.</p>
    <p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 22px; border-radius: 999px; background: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600;">Set your password and join</a></p>
    <p style="color: #4b5c58; font-size: 14px;">This link works once and expires on ${escapeHtml(expires)}.<br>If you weren't expecting this, you can ignore this email.</p>
  </body>
</html>`;

  return { subject, text, html };
}
