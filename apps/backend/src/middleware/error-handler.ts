import type { ErrorRequestHandler } from "express";
import { AppError, type ErrorBody } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";

/** Errors raised by express.json() (body-parser) carry a `type` and an HTTP status. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === "object" && err !== null && "type" in err && typeof (err as { type: unknown }).type === "string";
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (isBodyParserError(err)) {
    if (err.type === "entity.parse.failed") return new AppError(400, "VALIDATION_ERROR", "Request body is not valid JSON");
    if (err.type === "entity.too.large") return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  return null;
}

/**
 * Maps every error to the standard envelope (docs/API_CONTRACT.md §1).
 * Unexpected errors are logged with the request id and returned as a generic 500 — never a stack trace.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    // Response already started streaming: let Express's default handler close the connection.
    if (res.headersSent) {
      next(err);
      return;
    }

    const appError = toAppError(err);

    if (appError) {
      if (appError.status >= 500) logger.error(appError.message, { requestId: req.requestId, code: appError.code });
    } else {
      logger.error("unhandled error", { requestId: req.requestId, err });
    }

    const status = appError?.status ?? 500;
    const body: ErrorBody = {
      error: {
        code: appError?.code ?? "INTERNAL_ERROR",
        message: appError?.message ?? "Something went wrong. Please try again later.",
        ...(appError?.details ? { details: appError.details } : {}),
        requestId: req.requestId,
      },
    };

    res.status(status).json(body);
  };
}
