import { type RequestHandler, Router } from "express";
import { requireRole } from "../../middleware/require-role.js";
import { requireSociety } from "../../middleware/require-society.js";
import { createSocietiesController } from "./societies.controller.js";
import type { SocietiesService } from "./societies.service.js";

/** Mounted at /api/societies. ADMIN only (docs/API_CONTRACT.md §4 Societies). */
export function societiesRouter(deps: { service: SocietiesService; requireAuth: RequestHandler }): Router {
  const controller = createSocietiesController(deps);
  const router = Router();

  router.use(deps.requireAuth, requireRole("ADMIN"));
  router.post("/", controller.create);
  router.patch("/current", requireSociety, controller.updateCurrent);

  return router;
}
