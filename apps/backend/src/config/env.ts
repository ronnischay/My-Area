import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * The ONLY place that reads process.env (docs/ARCHITECTURE.md §3).
 * New variables must also be added to apps/backend/.env.example, ARCHITECTURE.md §7 and the README.
 */

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
const EMAIL_PROVIDERS = ["smtp", "brevo", "console"] as const;

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    // Comma-separated list of allowed browser origins for CORS and the same-origin check.
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

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Public frontend URL used to build links in emails (invites).
    APP_URL: z
      .url({ protocol: /^https?$/ })
      .default("http://localhost:3000")
      .transform((value) => value.replace(/\/+$/, "")),

    EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).default("console"),
    EMAIL_FROM: z.string().trim().min(3).max(255).default("MyArea <no-reply@localhost>"),
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    // true = TLS from the start (port 465); false = STARTTLS upgrade when the server offers it.
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    // Signs forgot-password links (no table, D030). Required in production; a random one per run otherwise.
    PASSWORD_RESET_SECRET: z.string().min(32, "must be at least 32 characters").optional(),

    // Brevo's HTTPS email API: for hosts that block SMTP ports (e.g. Render's free plan).
    BREVO_API_KEY: z.string().trim().min(1).optional(),

    // Report photos are stored on this server's disk (D021). Relative paths resolve from the working directory.
    UPLOAD_DIR: z.string().trim().min(1).default("uploads"),

    // AI suggestions on the report form (docs/features/ai-suggestions.md). Off without a key.
    GEMINI_API_KEY: z.string().trim().min(1).optional(),
    GEMINI_MODEL: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9.-]*$/, "must be a Gemini model id, e.g. gemini-3.5-flash-lite")
      .default("gemini-3.5-flash-lite"),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "console" && env.NODE_ENV === "production") {
      ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "console is not allowed in production" });
    }
    if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "required when EMAIL_PROVIDER=smtp" });
    }
    if (env.NODE_ENV === "production" && !env.PASSWORD_RESET_SECRET) {
      ctx.addIssue({ code: "custom", path: ["PASSWORD_RESET_SECRET"], message: "required in production" });
    }
    if (env.EMAIL_PROVIDER === "brevo" && !env.BREVO_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["BREVO_API_KEY"], message: "required when EMAIL_PROVIDER=brevo" });
    }
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
      ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP_USER and SMTP_PASS must be set together" });
    }
  });

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

export type EmailConfig =
  | { provider: "console"; from: string }
  | { provider: "smtp"; from: string; smtp: SmtpConfig }
  | { provider: "brevo"; from: string; apiKey: string };

/** Where uploaded photos are kept. Only local disk for now; Cloudinary may be added later (D021). */
export interface MediaConfig {
  storage: "local";
  /** Absolute path. */
  uploadDir: string;
}

/** null when no key is set: the feature is off and the button hidden. */
export type AiConfig = { provider: "gemini"; apiKey: string; model: string } | null;

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  frontendOrigins: string[];
  logLevel: LogLevel;
  databaseUrl: string;
  appUrl: string;
  email: EmailConfig;
  /** HMAC key for forgot-password links. Outside production a random one per run (links die on restart). */
  passwordResetSecret: string;
  media: MediaConfig;
  ai: AiConfig;
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
  const email: EmailConfig =
    env.EMAIL_PROVIDER === "brevo" && env.BREVO_API_KEY
      ? { provider: "brevo", from: env.EMAIL_FROM, apiKey: env.BREVO_API_KEY }
      : env.EMAIL_PROVIDER === "smtp" && env.SMTP_HOST
      ? {
          provider: "smtp",
          from: env.EMAIL_FROM,
          smtp: {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
          },
        }
      : { provider: "console", from: env.EMAIL_FROM };

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendOrigins: env.FRONTEND_ORIGIN,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    appUrl: env.APP_URL,
    email,
    passwordResetSecret: env.PASSWORD_RESET_SECRET ?? randomBytes(32).toString("base64url"),
    media: { storage: "local", uploadDir: resolve(env.UPLOAD_DIR) },
    ai: env.GEMINI_API_KEY ? { provider: "gemini", apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL } : null,
  };
}
