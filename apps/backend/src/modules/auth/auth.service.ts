import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { PasswordHasher } from "../../lib/password.js";
import { hashToken, newToken } from "../../lib/tokens.js";
import { SESSION_TTL_MS } from "./auth.constants.js";
import type { AuthRepository } from "./auth.repository.js";
import type { AuthContext, CurrentUser, InviteDetails, SessionGrant } from "./auth.types.js";
import type { LoginRateLimiter } from "./login-rate-limiter.js";

export interface AuthService {
  login(email: string, password: string): Promise<SessionGrant>;
  logout(token: string | undefined): Promise<void>;
  /** Null when the token is unknown/expired or the user is not ACTIVE. Never throws for bad tokens. */
  resolveSession(token: string): Promise<AuthContext | null>;
  getCurrentUser(userId: string): Promise<CurrentUser>;
  lookupInvite(token: string): Promise<InviteDetails>;
  acceptInvite(token: string, password: string): Promise<SessionGrant>;
}

export interface AuthServiceDeps {
  repository: AuthRepository;
  passwordHasher: PasswordHasher;
  rateLimiter: LoginRateLimiter;
  clock: Clock;
}

const invalidCredentials = () => new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
const unauthenticated = () => new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
const inviteInvalid = () =>
  new AppError(
    410,
    "INVITE_INVALID",
    "This invite link is invalid or has expired. Ask your society admin to send a new one.",
  );

export function createAuthService({ repository, passwordHasher, rateLimiter, clock }: AuthServiceDeps): AuthService {
  // Verified against when the email is unknown, so the response time doesn't reveal which emails exist.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= passwordHasher.hash(newToken()));

  const newSession = (now: Date) => {
    const token = newToken();
    return { token, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + SESSION_TTL_MS) };
  };

  const loadUser = async (userId: string) => {
    const user = await repository.findCurrentUser(userId);
    if (!user) throw unauthenticated();
    return user;
  };

  return {
    async login(email, password) {
      const now = clock();
      const retryAfter = rateLimiter.retryAfterSeconds(email, now);
      if (retryAfter > 0) {
        throw new AppError(
          429,
          "RATE_LIMITED",
          `Too many sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
          { retryAfterSeconds: retryAfter },
          { "Retry-After": String(retryAfter) },
        );
      }

      const credentials = await repository.findCredentialsByEmail(email);
      const passwordMatches = credentials?.passwordHash
        ? await passwordHasher.verify(password, credentials.passwordHash)
        : await passwordHasher.verify(password, await getDummyHash()).then(() => false);

      if (!credentials || !passwordMatches || credentials.status !== "ACTIVE") {
        rateLimiter.recordFailure(email, now);
        throw invalidCredentials();
      }

      rateLimiter.reset(email);
      const { token, tokenHash, expiresAt } = newSession(now);
      await repository.startSession({ userId: credentials.id, session: { tokenHash, expiresAt }, now });
      return { user: await loadUser(credentials.id), token, expiresAt };
    },

    async logout(token) {
      if (token) await repository.deleteSession(hashToken(token));
    },

    async resolveSession(token) {
      const session = await repository.findSessionUser(hashToken(token), clock());
      if (!session || session.status !== "ACTIVE") return null;
      return { userId: session.userId, role: session.role, societyId: session.societyId };
    },

    getCurrentUser: loadUser,

    async lookupInvite(token) {
      const invite = await repository.findInvite(hashToken(token), clock());
      if (!invite) throw inviteInvalid();
      return invite;
    },

    async acceptInvite(token, password) {
      const now = clock();
      const tokenHash = hashToken(token);
      const invite = await repository.findInvite(tokenHash, now);
      if (!invite) throw inviteInvalid();
      if (password.trim().toLowerCase() === invite.email) {
        throw new AppError(400, "VALIDATION_ERROR", "Some fields need attention", {
          fieldErrors: { password: ["Password can't be the same as your email"] },
        });
      }

      const passwordHash = await passwordHasher.hash(password);
      const session = newSession(now);
      const userId = await repository.acceptInvite({
        tokenHash,
        passwordHash,
        session: { tokenHash: session.tokenHash, expiresAt: session.expiresAt },
        now,
      });
      // Someone else accepted (or the admin replaced the link) between lookup and accept.
      if (!userId) throw inviteInvalid();

      return { user: await loadUser(userId), token: session.token, expiresAt: session.expiresAt };
    },
  };
}
