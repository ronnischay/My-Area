import { existsSync } from "node:fs";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { createLogger } from "./lib/logger.js";
import { createPasswordHasher } from "./lib/password.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createSocietiesRepository } from "./modules/societies/societies.repository.js";

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
const app = createApp({
  config,
  logger,
  repositories: { auth: createAuthRepository(db), societies: createSocietiesRepository(db) },
  passwordHasher: createPasswordHasher(),
});

const server = app.listen(config.port, () => {
  logger.info("backend listening", { port: config.port, nodeEnv: config.nodeEnv });
});

function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
