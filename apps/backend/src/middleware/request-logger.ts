import type { RequestHandler } from "express";
import type { Logger } from "../lib/logger.js";

/** Logs one line per request on completion. Query strings are omitted to avoid logging user input. */
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      logger.info("request completed", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
      });
    });
    next();
  };
}
