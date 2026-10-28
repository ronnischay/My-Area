import type { Request, RequestHandler } from "express";
import { readCookie } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";
import { SESSION_COOKIE } from "../modules/auth/auth.constants.js";
import type { AuthContext } from "../modules/auth/auth.types.js";

export type SessionResolver = (token: string) => Promise<AuthContext | null>;

export function sessionToken(req: Request): string | undefined {
  return readCookie(req.get("cookie"), SESSION_COOKIE);
}

/** Resolves the session cookie to `req.auth`; 401 UNAUTHENTICATED otherwise (docs/API_CONTRACT.md §3). */
export function requireAuth(resolve: SessionResolver): RequestHandler {
  return async (req, _res, next) => {
    const token = sessionToken(req);
    const auth = token ? await resolve(token) : null;
    if (!auth) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    req.auth = auth;
    next();
  };
}

/** `req.auth` for handlers mounted behind requireAuth. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return req.auth;
}
