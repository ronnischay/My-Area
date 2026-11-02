import type { Clock } from "../../lib/clock.js";
import type { Logger } from "../../lib/logger.js";
import type { AuthRepository } from "./auth.repository.js";

/**
 * Deletes expired sessions (older than the 7-day session lifetime) once at startup and then every
 * `intervalMs`. Expired sessions already don't work; this only stops the table growing. A plain
 * timer, no scheduler package: on a host that sleeps when idle it runs at each wake-up instead.
 * Returns `stop()` for shutdown.
 */
export function startSessionCleanup({
  repository,
  logger,
  clock,
  intervalMs,
}: {
  repository: Pick<AuthRepository, "deleteExpiredSessions">;
  logger: Logger;
  clock: Clock;
  intervalMs: number;
}): { stop: () => void; runOnce: () => Promise<void> } {
  const runOnce = async () => {
    try {
      const deleted = await repository.deleteExpiredSessions(clock());
      logger.info("expired sessions deleted", { deleted });
    } catch (err) {
      logger.error("session cleanup failed", { err });
    }
  };

  void runOnce();
  const timer = setInterval(() => void runOnce(), intervalMs);
  // Never keeps the process alive on its own.
  timer.unref();
  return { stop: () => clearInterval(timer), runOnce };
}
