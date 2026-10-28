import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import type { Logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { healthRouter } from "./modules/health/health.routes.js";

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
}

/**
 * Builds the Express app without binding a port, so Supertest can use it directly.
 * Dependencies (config, logger, later repositories and providers) are injected for testability.
 */
export function createApp({ config, logger }: AppDeps): Express {
  const app = express();

  app.use(requestId());
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigins,
      exposedHeaders: ["X-Request-Id"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter());

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
