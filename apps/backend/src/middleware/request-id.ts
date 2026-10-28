import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Accept a caller-provided id only if it is short and harmless to log/echo.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get("x-request-id");
    req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  };
}
