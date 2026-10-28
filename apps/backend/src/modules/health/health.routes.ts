import { Router } from "express";

/** GET /health — liveness only; no DB call (docs/API_CONTRACT.md §3). */
export function healthRouter(): Router {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  return router;
}
