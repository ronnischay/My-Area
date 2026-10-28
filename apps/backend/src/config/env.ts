import { z } from "zod";

/**
 * The ONLY place that reads process.env (docs/ARCHITECTURE.md §3).
 * New variables must also be added to apps/backend/.env.example, ARCHITECTURE.md §7 and the README.
 */

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Comma-separated list of allowed browser origins for CORS.
  FRONTEND_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  frontendOrigins: string[];
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

/** Parses and validates environment variables. Throws ConfigError listing every problem (never the values). */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }

  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendOrigins: env.FRONTEND_ORIGIN,
    logLevel: env.LOG_LEVEL,
  };
}
