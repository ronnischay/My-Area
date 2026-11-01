import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireRole } from "../../middleware/require-role.js";
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
  // Thumbs-up: any member (rules in the service).
  router.post("/:id/votes", controller.vote);
  router.delete("/:id/votes", controller.unvote);
  // Managers and admins only (docs/API_CONTRACT.md Phase 7).
  router.patch("/:id/status", requireRole("MANAGER"), controller.changeStatus);
  router.post("/:id/media", requireRole("MANAGER"), uploadPhoto, controller.addResolutionPhoto);

  return router;
}
