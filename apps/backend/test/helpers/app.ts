import { vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config/env.js";
import type { Logger } from "../../src/lib/logger.js";

export const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 0,
  frontendOrigins: ["http://localhost:3000"],
  logLevel: "silent",
  // Never connected to in unit/HTTP tests; repositories are in-memory fakes.
  databaseUrl: "postgres://test@localhost:5432/unused",
  appUrl: "http://localhost:3000",
  email: { provider: "console", from: "MyArea <no-reply@test.local>" },
};

/** A logger whose methods are spies, so tests can assert on (and silence) log output. */
export function createFakeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies Logger;
}

export function createTestApp(overrides: Partial<AppConfig> = {}) {
  const logger = createFakeLogger();
  const app = createApp({ config: { ...testConfig, ...overrides }, logger });
  return { app, logger };
}
