import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeLogger } from "../../../test/helpers/app.js";
import { startSessionCleanup } from "./session-cleanup.js";

afterEach(() => vi.useRealTimers());

describe("startSessionCleanup", () => {
  it("deletes expired sessions at start and then on every interval, until stopped", async () => {
    vi.useFakeTimers();
    const deleteExpiredSessions = vi.fn(async () => 2);
    const logger = createFakeLogger();
    const now = new Date("2026-11-01T10:00:00.000Z");

    const cleanup = startSessionCleanup({ repository: { deleteExpiredSessions }, logger, clock: () => now, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);
    expect(deleteExpiredSessions).toHaveBeenCalledWith(now);
    expect(logger.info).toHaveBeenCalledWith("expired sessions deleted", { deleted: 2 });

    await vi.advanceTimersByTimeAsync(2000);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(3);

    cleanup.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(3);
  });

  it("logs a failure and keeps going", async () => {
    vi.useFakeTimers();
    const deleteExpiredSessions = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(0);
    const logger = createFakeLogger();

    const cleanup = startSessionCleanup({ repository: { deleteExpiredSessions }, logger, clock: () => new Date(), intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.error).toHaveBeenCalledWith("session cleanup failed", { err: expect.any(Error) });
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(2);
    cleanup.stop();
  });
});
