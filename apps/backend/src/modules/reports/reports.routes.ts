import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireSociety } from "../../middleware/require-society.js";
import { uploadPhoto } from "../../middleware/upload-photo.js";
import { createReportsController } from "./reports.controller.js";
import type { ReportsService } from "./reports.service.js";

/** Mounted at /api/reports. Any signed-in member of a society (docs/API_CONTRACT.md §4 Reports). */
export function reportsRouter(deps: { service: ReportsService; requireAuth: RequestHandler }): Router {
  const controller = createReportsController(deps);
  const router = Router();

  router.use(noStore, deps.requireAuth, requireSociety);
  router.get("/", controller.list);
  // multipart/form-data: text fields + one `photo` (docs/API_CONTRACT.md POST /api/reports).
  router.post("/", uploadPhoto, controller.create);
  router.get("/:id", controller.get);

  return router;
}
