import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, redact } from "./logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redact", () => {
  it("masks sensitive keys at any depth and keeps other values", () => {
    expect(
      redact({
        reportId: "r1",
        apiKey: "abc",
        provider: { CLOUDINARY_API_SECRET: "s3cret", headers: { Authorization: "Bearer x", accept: "json" } },
        list: [{ password: "p" }],
      }),
    ).toEqual({
      reportId: "r1",
      apiKey: "[REDACTED]",
      provider: { CLOUDINARY_API_SECRET: "[REDACTED]", headers: { Authorization: "[REDACTED]", accept: "json" } },
      list: [{ password: "[REDACTED]" }],
    });
  });

  it("reduces errors to name and message (no stack)", () => {
    expect(redact(new TypeError("bad input"))).toEqual({ name: "TypeError", message: "bad input" });
  });
});

describe("createLogger", () => {
  it("writes JSON lines at or above the configured level", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = createLogger({ level: "info" });

    logger.debug("hidden");
    logger.info("hello", { token: "t" });
    logger.error("failed");

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
      level: "info",
      message: "hello",
      token: "[REDACTED]",
    });
    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when silent", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    createLogger({ level: "silent" }).error("nope");

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });
});
