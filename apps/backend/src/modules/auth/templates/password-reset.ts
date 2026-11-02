import { escapeHtml } from "../../../lib/html.js";

export interface PasswordResetEmailInput {
  name: string;
  link: string;
  expiresAt: Date;
}

// Recipients may be anywhere; state the timezone explicitly rather than guess theirs.
const expiryFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Plain text + simple HTML. Every user-supplied value is HTML-escaped. */
export function passwordResetEmail({ name, link, expiresAt }: PasswordResetEmailInput) {
  const expires = `${expiryFormat.format(expiresAt)} UTC`;
  const subject = "Reset your MyArea password";

  const text = [
    `Hi ${name},`,
    "",
    "Someone asked to reset the password for your MyArea account.",
    "",
    `Choose a new password: ${link}`,
    "",
    `This link works once and expires on ${expires}. Resetting signs you out on every other device.`,
    "If you didn't ask for this, you can ignore this email: your password stays the same.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #10201e; line-height: 1.5;">
    <p>Hi ${escapeHtml(name)},</p>
    <p>Someone asked to reset the password for your MyArea account.</p>
    <p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 22px; border-radius: 999px; background: #057a0d; color: #ffffff; text-decoration: none; font-weight: 600;">Choose a new password</a></p>
    <p style="color: #4b5c58; font-size: 14px;">This link works once and expires on ${escapeHtml(expires)}. Resetting signs you out on every other device.<br>If you didn't ask for this, you can ignore this email: your password stays the same.</p>
  </body>
</html>`;

  return { subject, text, html };
}
