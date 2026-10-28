import type { Request, RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import type { AuthContext } from "../modules/auth/auth.types.js";
import { getAuth } from "./require-auth.js";

export type SocietyAuthContext = AuthContext & { societyId: string };

/** 403 SOCIETY_REQUIRED for an admin who hasn't created a society yet. Mount after requireAuth. */
export const requireSociety: RequestHandler = (req, _res, next) => {
  getSocietyAuth(req);
  next();
};

/** `req.auth` with a non-null `societyId`: the tenant every query must be filtered by. */
export function getSocietyAuth(req: Request): SocietyAuthContext {
  const auth = getAuth(req);
  if (!auth.societyId) {
    throw new AppError(403, "SOCIETY_REQUIRED", "Set up your society first.");
  }
  return { ...auth, societyId: auth.societyId };
}
