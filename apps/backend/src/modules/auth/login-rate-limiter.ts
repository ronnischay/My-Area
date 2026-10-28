/**
 * In-memory failed-login limiter keyed by lower-cased email (docs/features/auth.md).
 * Fixed window from the first failure. Single process only: resets on restart and is not shared
 * across instances (documented limitation).
 */
export interface LoginRateLimiter {
  /** Seconds until the key may try again; 0 when allowed. */
  retryAfterSeconds(key: string, now: Date): number;
  recordFailure(key: string, now: Date): void;
  reset(key: string): void;
}

const MAX_TRACKED_KEYS = 10_000;

export function createLoginRateLimiter({ maxFailures, windowMs }: { maxFailures: number; windowMs: number }): LoginRateLimiter {
  const entries = new Map<string, { failures: number; windowStart: number }>();

  const current = (key: string, now: number) => {
    const entry = entries.get(key);
    if (entry && now - entry.windowStart >= windowMs) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  const prune = (now: number) => {
    for (const [key, entry] of entries) {
      if (now - entry.windowStart >= windowMs) entries.delete(key);
    }
  };

  return {
    retryAfterSeconds(key, now) {
      const entry = current(key, now.getTime());
      if (!entry || entry.failures < maxFailures) return 0;
      return Math.ceil((entry.windowStart + windowMs - now.getTime()) / 1000);
    },

    recordFailure(key, now) {
      const time = now.getTime();
      const entry = current(key, time);
      if (entry) {
        entry.failures += 1;
        return;
      }
      if (entries.size >= MAX_TRACKED_KEYS) prune(time);
      entries.set(key, { failures: 1, windowStart: time });
    },

    reset(key) {
      entries.delete(key);
    },
  };
}
