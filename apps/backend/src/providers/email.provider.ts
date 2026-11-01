import nodemailer from "nodemailer";
import type { EmailConfig } from "../config/env.js";
import type { Logger } from "../lib/logger.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Services depend on this, never on nodemailer (docs/ARCHITECTURE.md §3). The sender owns `from`. */
export interface EmailSender {
  send(message: EmailMessage): Promise<{ messageId?: string }>;
}

const SMTP_TIMEOUT_MS = 15_000;
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function createEmailSender(config: EmailConfig, logger: Logger): EmailSender {
  if (config.provider === "console") return createConsoleEmailSender(config.from, logger);
  if (config.provider === "brevo") return createBrevoEmailSender({ apiKey: config.apiKey, from: config.from });

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.auth ? { auth: config.smtp.auth } : {}),
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  return {
    async send(message) {
      const info = await transporter.sendMail({ from: config.from, ...message });
      return { messageId: info.messageId };
    },
  };
}

/**
 * Development only (env.ts refuses EMAIL_PROVIDER=console in production): logs the message,
 * including invite links, instead of sending it.
 */
export function createConsoleEmailSender(from: string, logger: Logger): EmailSender {
  return {
    async send({ to, subject, text }) {
      logger.info("email not sent (EMAIL_PROVIDER=console)", { from, to, subject, text });
      return {};
    },
  };
}

/** `"MyArea <no-reply@example.com>"` or `no-reply@example.com` → Brevo's `{ name?, email }`. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]?.trim();
  return { ...(name ? { name } : {}), email: (match[2] ?? "").trim() };
}

/**
 * Brevo's transactional email API over HTTPS with Node's fetch: no SDK package. Used where outbound
 * SMTP ports are blocked (Render's free plan). The key goes in the `api-key` header, never the URL,
 * and never into errors or logs. `from` must be a sender verified in Brevo.
 */
export function createBrevoEmailSender({
  apiKey,
  from,
  fetchImpl = fetch,
  timeoutMs = SMTP_TIMEOUT_MS,
}: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): EmailSender {
  const sender = parseSender(from);
  return {
    async send({ to, subject, text, html }) {
      let response: Response;
      try {
        response = await fetchImpl(BREVO_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": apiKey },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
        });
      } catch (err) {
        throw new Error(err instanceof Error && err.name === "TimeoutError" ? "Brevo timed out" : "Brevo unreachable");
      }

      const body = (await response.json().catch(() => null)) as { messageId?: unknown; code?: unknown; message?: unknown } | null;
      if (!response.ok) {
        // Brevo's own code and message say what to fix (e.g. an unverified sender); capped in length.
        const reason = [body?.code, body?.message].filter((part) => typeof part === "string").join(": ").slice(0, 200);
        throw new Error(`Brevo HTTP ${response.status}${reason ? ` (${reason})` : ""}`);
      }
      return typeof body?.messageId === "string" ? { messageId: body.messageId } : {};
    },
  };
}
