import { describe, expect, it } from "vitest";
import { createLoginRateLimiter } from "./login-rate-limiter.js";

const WINDOW_MS = 15 * 60 * 1000;
const start = new Date("2026-10-28T10:00:00.000Z");
const at = (ms: number) => new Date(start.getTime() + ms);

describe("login rate limiter", () => {
  it("allows up to the limit and then blocks with the remaining window in seconds", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 3, windowMs: WINDOW_MS });

    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfterSeconds("meera@example.com", at(i * 1000))).toBe(0);
      limiter.recordFailure("meera@example.com", at(i * 1000));
    }

    expect(limiter.retryAfterSeconds("meera@example.com", at(60_000))).toBe((WINDOW_MS - 60_000) / 1000);
    expect(limiter.retryAfterSeconds("someone-else@example.com", at(60_000))).toBe(0);
  });

  it("opens again once the window has passed", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 1, windowMs: WINDOW_MS });
    limiter.recordFailure("meera@example.com", start);

    expect(limiter.retryAfterSeconds("meera@example.com", at(WINDOW_MS - 1))).toBe(1);
    expect(limiter.retryAfterSeconds("meera@example.com", at(WINDOW_MS))).toBe(0);
  });

  it("forgets failures after a successful login", () => {
    const limiter = createLoginRateLimiter({ maxFailures: 1, windowMs: WINDOW_MS });
    limiter.recordFailure("meera@example.com", start);
    limiter.reset("meera@example.com");

    expect(limiter.retryAfterSeconds("meera@example.com", start)).toBe(0);
  });
});
