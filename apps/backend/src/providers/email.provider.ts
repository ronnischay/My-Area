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

export function createEmailSender(config: EmailConfig, logger: Logger): EmailSender {
  if (config.provider === "console") return createConsoleEmailSender(config.from, logger);

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
