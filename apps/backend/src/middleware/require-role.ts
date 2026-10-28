import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import type { UserRole } from "../modules/users/users.types.js";
import { getAuth } from "./require-auth.js";

/** 403 FORBIDDEN unless the signed-in user has one of `roles`. Mount after requireAuth. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuth(req).role)) {
      throw new AppError(403, "FORBIDDEN", "You don't have permission to do that.");
    }
    next();
  };
}
