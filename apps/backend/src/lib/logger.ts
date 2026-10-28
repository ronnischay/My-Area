import type { LogLevel } from "../config/env.js";

export type LogMeta = Record<string, unknown>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

const LEVEL_ORDER: Record<Exclude<LogLevel, "silent">, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /secret|password|passwd|token|api[-_]?key|authorization|cookie|credential/i;
const REDACTED = "[REDACTED]";

/** Recursively replaces values under sensitive-looking keys. Errors are reduced to name + message. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redact(inner, depth + 1)]),
    );
  }
  return value;
}

/** Structured JSON-lines logger with secret redaction. */
export function createLogger({ level }: { level: LogLevel }): Logger {
  const threshold = level === "silent" ? Infinity : LEVEL_ORDER[level];

  const write = (lvl: keyof typeof LEVEL_ORDER, message: string, meta?: LogMeta) => {
    if (LEVEL_ORDER[lvl] < threshold) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level: lvl, message, ...(redact(meta ?? {}) as LogMeta) });
    if (lvl === "error" || lvl === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}
