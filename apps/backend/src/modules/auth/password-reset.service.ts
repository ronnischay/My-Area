import type { BackgroundTasks } from "../../lib/background-tasks.js";
import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import type { PasswordHasher } from "../../lib/password.js";
import { hashToken, newToken } from "../../lib/tokens.js";
import type { EmailSender } from "../../providers/email.provider.js";
import { PASSWORD_RESET_TTL_MS, SESSION_TTL_MS } from "./auth.constants.js";
import type { AuthRepository } from "./auth.repository.js";
import type { SessionGrant } from "./auth.types.js";
import type { LoginRateLimiter } from "./login-rate-limiter.js";
import { createResetToken, passwordFingerprint, readResetToken } from "./password-reset-token.js";
import { passwordResetEmail } from "./templates/password-reset.js";

export interface PasswordResetService {
  /**
   * Emails a reset link to an ACTIVE account, in the background. Always resolves the same way,
   * whether or not the email has an account, so the endpoint can't be used to find accounts.
   */
  request(email: string): void;
  /** The account the link is for; 410 RESET_LINK_INVALID when it isn't valid any more. */
  lookup(token: string): Promise<{ name: string; email: string }>;
  /** Sets the password, signs out every other session and starts a new one. */
  confirm(token: string, password: string): Promise<Omit<SessionGrant, "user"> & { userId: string }>;
}

export interface PasswordResetServiceDeps {
  repository: AuthRepository;
  passwordHasher: PasswordHasher;
  emailSender: EmailSender;
  backgroundTasks: BackgroundTasks;
  /** Requests per email address, counted with the login limiter's fixed window. */
  rateLimiter: LoginRateLimiter;
  logger: Logger;
  clock: Clock;
  /** Public frontend URL; links are `${appUrl}/reset-password?token=…`. */
  appUrl: string;
  secret: string;
}

const resetLinkInvalid = () =>
  new AppError(410, "RESET_LINK_INVALID", "This reset link is invalid or has expired. Ask for a new one.");

export function createPasswordResetService({
  repository,
  passwordHasher,
  emailSender,
  backgroundTasks,
  rateLimiter,
  logger,
  clock,
  appUrl,
  secret,
}: PasswordResetServiceDeps): PasswordResetService {
  /** The ACTIVE account a token is for, if the token is valid and the password hasn't changed since. */
  const accountFor = async (token: string) => {
    const payload = readResetToken(token, secret, clock());
    if (!payload) return null;
    const account = await repository.findResetAccountById(payload.userId);
    if (!account || account.status !== "ACTIVE" || !account.passwordHash) return null;
    if (passwordFingerprint(account.passwordHash) !== payload.fingerprint) return null;
    return { ...account, passwordHash: account.passwordHash };
  };

  return {
    request(email) {
      const now = clock();
      if (rateLimiter.retryAfterSeconds(email, now) > 0) {
        logger.warn("password reset not sent: too many requests for this email");
        return;
      }
      rateLimiter.recordFailure(email, now);

      backgroundTasks.run("password reset email", async () => {
        const account = await repository.findResetAccountByEmail(email);
        // Invited people use their invite; disabled accounts get nothing.
        if (!account || account.status !== "ACTIVE" || !account.passwordHash) return;

        const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
        const token = createResetToken({ userId: account.id, expiresAt, fingerprint: passwordFingerprint(account.passwordHash) }, secret);
        const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
        try {
          await emailSender.send({ to: account.email, ...passwordResetEmail({ name: account.name, link, expiresAt }) });
        } catch (err) {
          logger.warn("password reset email failed", { userId: account.id, err });
        }
      });
    },

    async lookup(token) {
      const account = await accountFor(token);
      if (!account) throw resetLinkInvalid();
      return { name: account.name, email: account.email };
    },

    async confirm(token, password) {
      const account = await accountFor(token);
      if (!account) throw resetLinkInvalid();
      if (password.trim().toLowerCase() === account.email) {
        throw new AppError(400, "VALIDATION_ERROR", "Some fields need attention", {
          fieldErrors: { password: ["Password can't be the same as your email"] },
        });
      }

      const now = clock();
      const sessionToken = newToken();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      const changed = await repository.resetPassword({
        userId: account.id,
        expectedPasswordHash: account.passwordHash,
        passwordHash: await passwordHasher.hash(password),
        session: { tokenHash: hashToken(sessionToken), expiresAt },
        now,
      });
      // The password changed (another reset, or the same link twice) between the check and the update.
      if (!changed) throw resetLinkInvalid();
      return { userId: account.id, token: sessionToken, expiresAt };
    },
  };
}
