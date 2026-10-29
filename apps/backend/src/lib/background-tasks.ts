import type { Logger } from "./logger.js";

/**
 * Work that runs after the response is sent (e.g. emails), so a slow provider never delays the user.
 * Failures are logged, never thrown. `idle()` resolves when nothing is running: tests await it, and
 * the server awaits it on shutdown so in-flight emails finish before the DB pool closes.
 */
export interface BackgroundTasks {
  run(name: string, task: () => Promise<void>): void;
  idle(): Promise<void>;
}

export function createBackgroundTasks(logger: Logger): BackgroundTasks {
  const pending = new Set<Promise<void>>();

  return {
    run(name, task) {
      const promise: Promise<void> = Promise.resolve()
        .then(task)
        .catch((err: unknown) => logger.error("background task failed", { task: name, err }))
        .finally(() => pending.delete(promise));
      pending.add(promise);
    },

    async idle() {
      while (pending.size > 0) await Promise.all(pending);
    },
  };
}
