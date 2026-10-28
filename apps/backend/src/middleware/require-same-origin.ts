import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence on top of SameSite=Lax cookies: a state-changing request that carries an `Origin`
 * header must come from an allowed frontend origin. Requests without `Origin` (curl, server-side
 * fetches) pass; browsers always send it on cross-origin POST/PATCH/DELETE.
 */
export function requireSameOrigin(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (!SAFE_METHODS.has(req.method) && origin !== undefined && !allowed.has(origin)) {
      throw new AppError(403, "FORBIDDEN", "Request origin is not allowed.");
    }
    next();
  };
}
