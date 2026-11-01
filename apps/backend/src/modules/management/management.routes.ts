import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireRole } from "../../middleware/require-role.js";
import { getSocietyAuth, requireSociety } from "../../middleware/require-society.js";
import type { ReportsService } from "../reports/reports.service.js";

/** Mounted at /api/management. MANAGER of a society; counts are for that society only. */
export function managementRouter(deps: { reports: ReportsService; requireAuth: RequestHandler }): Router {
  const router = Router();
  router.use(noStore, deps.requireAuth, requireSociety, requireRole("MANAGER"));

  router.get("/stats", async (req, res) => {
    res.json({ data: { byStatus: await deps.reports.countByStatus(getSocietyAuth(req)) } });
  });

  return router;
}
