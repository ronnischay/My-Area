import type { RequestHandler } from "express";

/** Auth and admin responses carry personal data and must not be cached (docs/API_CONTRACT.md §5). */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
