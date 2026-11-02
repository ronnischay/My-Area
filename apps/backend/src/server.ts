import { existsSync } from "node:fs";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { createBackgroundTasks } from "./lib/background-tasks.js";
import { systemClock } from "./lib/clock.js";
import { createLogger } from "./lib/logger.js";
import { createPasswordHasher } from "./lib/password.js";
import { SESSION_CLEANUP_INTERVAL_MS } from "./modules/auth/auth.constants.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { startSessionCleanup } from "./modules/auth/session-cleanup.js";
import { createMediaRepository } from "./modules/media/media.repository.js";
import { createNotificationsRepository } from "./modules/notifications/notifications.repository.js";
import { createReportsRepository } from "./modules/reports/reports.repository.js";
import { createSocietiesRepository } from "./modules/societies/societies.repository.js";
import { createUsersRepository } from "./modules/users/users.repository.js";
import { createEmailSender } from "./providers/email.provider.js";
import { createLocalMediaStorage } from "./providers/media-storage.js";
import { createGeminiSuggestionProvider } from "./providers/suggestion.provider.js";

// The only file that binds a port. Loads apps/backend/.env when present (real env vars take precedence).
if (existsSync(".env")) process.loadEnvFile(".env");

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const logger = createLogger({ level: config.logLevel });
const { db, pool } = createDatabase(config.databaseUrl);
const backgroundTasks = createBackgroundTasks(logger);
const authRepository = createAuthRepository(db);
const app = createApp({
  config,
  logger,
  repositories: {
    auth: authRepository,
    media: createMediaRepository(db),
    notifications: createNotificationsRepository(db),
    reports: createReportsRepository(db),
    societies: createSocietiesRepository(db),
    users: createUsersRepository(db),
  },
  emailSender: createEmailSender(config.email, logger),
  mediaStorage: createLocalMediaStorage(config.media.uploadDir),
  passwordHasher: createPasswordHasher(),
  backgroundTasks,
  suggestionProvider: config.ai ? createGeminiSuggestionProvider({ apiKey: config.ai.apiKey, model: config.ai.model }) : null,
});

const server = app.listen(config.port, () => {
  logger.info("backend listening", { port: config.port, nodeEnv: config.nodeEnv });
});

const sessionCleanup = startSessionCleanup({
  repository: authRepository,
  logger,
  clock: systemClock,
  intervalMs: SESSION_CLEANUP_INTERVAL_MS,
});

function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  sessionCleanup.stop();
  server.close(() => {
    // Let in-flight emails finish (they still read the DB) before closing the pool.
    backgroundTasks
      .idle()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
