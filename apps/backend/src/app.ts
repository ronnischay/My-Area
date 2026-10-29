import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import { type Clock, systemClock } from "./lib/clock.js";
import type { Logger } from "./lib/logger.js";
import type { PasswordHasher } from "./lib/password.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requireAuth } from "./middleware/require-auth.js";
import { requireSameOrigin } from "./middleware/require-same-origin.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "./modules/auth/auth.constants.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { createLoginRateLimiter } from "./modules/auth/login-rate-limiter.js";
import { healthRouter } from "./modules/health/health.routes.js";
import type { MediaRepository } from "./modules/media/media.repository.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import type { ReportsRepository } from "./modules/reports/reports.repository.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { createReportsService } from "./modules/reports/reports.service.js";
import type { SocietiesRepository } from "./modules/societies/societies.repository.js";
import { societiesRouter } from "./modules/societies/societies.routes.js";
import { createSocietiesService } from "./modules/societies/societies.service.js";
import type { UsersRepository } from "./modules/users/users.repository.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { createUsersService } from "./modules/users/users.service.js";
import type { EmailSender } from "./providers/email.provider.js";
import type { MediaStorage } from "./providers/media-storage.js";

export interface Repositories {
  auth: AuthRepository;
  media: MediaRepository;
  reports: ReportsRepository;
  societies: SocietiesRepository;
  users: UsersRepository;
}

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  repositories: Repositories;
  emailSender: EmailSender;
  mediaStorage: MediaStorage;
  passwordHasher: PasswordHasher;
  clock?: Clock;
}

/**
 * Builds the Express app without binding a port, so Supertest can use it directly.
 * Repositories and providers are injected: production passes Drizzle/SMTP, tests pass in-memory fakes.
 */
export function createApp({
  config,
  logger,
  repositories,
  emailSender,
  mediaStorage,
  passwordHasher,
  clock = systemClock,
}: AppDeps): Express {
  const app = express();

  app.use(requestId());
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigins,
      credentials: true,
      exposedHeaders: ["X-Request-Id"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(requireSameOrigin(config.frontendOrigins));

  const authService = createAuthService({
    repository: repositories.auth,
    passwordHasher,
    rateLimiter: createLoginRateLimiter({ maxFailures: LOGIN_MAX_FAILURES, windowMs: LOGIN_WINDOW_MS }),
    clock,
  });
  const authenticated = requireAuth(authService.resolveSession);

  app.use(healthRouter());
  app.use(
    "/api/auth",
    authRouter({ service: authService, requireAuth: authenticated, secureCookies: config.nodeEnv === "production" }),
  );
  app.use(
    "/api/societies",
    societiesRouter({ service: createSocietiesService({ repository: repositories.societies }), requireAuth: authenticated }),
  );
  app.use(
    "/api/admin/users",
    usersRouter({
      service: createUsersService({ repository: repositories.users, emailSender, logger, clock, appUrl: config.appUrl }),
      requireAuth: authenticated,
    }),
  );

  app.use(
    "/api/reports",
    reportsRouter({
      service: createReportsService({ repository: repositories.reports, storage: mediaStorage, logger }),
      requireAuth: authenticated,
    }),
  );
  app.use(
    "/api/media",
    mediaRouter({ repository: repositories.media, storage: mediaStorage, logger, requireAuth: authenticated }),
  );

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
