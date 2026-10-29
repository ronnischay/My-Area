import { escapeHtml } from "../../../lib/html.js";
import type { ReportCategory } from "../../reports/reports.types.js";

export interface NewReportEmailInput {
  recipientName: string;
  societyName: string;
  reporterName: string;
  title: string;
  description: string;
  category: ReportCategory;
  locationText: string;
  createdAt: Date;
  link: string;
}

/** Same wording the frontend uses for categories. */
export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  ROADS: "Roads",
  STREETLIGHTS: "Streetlights",
  WASTE: "Waste",
  WATER_DRAINAGE: "Water & drainage",
  PARKS: "Parks",
  NOISE: "Noise",
  SAFETY: "Safety",
  OTHER: "Other",
};

// Recipients may be anywhere; state the timezone explicitly rather than guess theirs.
const timeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Plain text + simple HTML. Every user-supplied value is HTML-escaped. The photo stays in the app (it needs a login). */
export function newReportEmail(input: NewReportEmailInput) {
  const { recipientName, societyName, reporterName, title, description, category, locationText, createdAt, link } = input;
  const categoryLabel = CATEGORY_LABELS[category];
  const submitted = `${timeFormat.format(createdAt)} UTC`;
  const subject = `[MyArea] ${societyName}: New report: ${title} (${categoryLabel})`;

  const text = [
    `Hi ${recipientName},`,
    "",
    `${reporterName} reported a new issue in ${societyName}.`,
    "",
    `Title: ${title}`,
    `Category: ${categoryLabel}`,
    `Location: ${locationText}`,
    `Submitted: ${submitted}`,
    "",
    description,
    "",
    `Open the report, with its photo: ${link}`,
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr><th align="left" style="padding: 4px 16px 4px 0; color: #4b5c58; font-weight: 600;">${label}</th><td style="padding: 4px 0;">${escapeHtml(value)}</td></tr>`;

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #10201e; line-height: 1.5;">
    <p>Hi ${escapeHtml(recipientName)},</p>
    <p>${escapeHtml(reporterName)} reported a new issue in <strong>${escapeHtml(societyName)}</strong>.</p>
    <h2 style="font-size: 20px; margin: 16px 0 8px;">${escapeHtml(title)}</h2>
    <table role="presentation" style="border-collapse: collapse;">
      ${row("Category", categoryLabel)}
      ${row("Location", locationText)}
      ${row("Submitted", submitted)}
    </table>
    <p style="white-space: pre-line;">${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 22px; border-radius: 999px; background: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600;">Open the report</a></p>
    <p style="color: #4b5c58; font-size: 14px;">You get this email because you manage ${escapeHtml(societyName)} on MyArea.</p>
  </body>
</html>`;

  return { subject, text, html };
}
