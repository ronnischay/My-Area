import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireRole } from "../../middleware/require-role.js";
import { createSocietiesController } from "./societies.controller.js";
import type { SocietiesService } from "./societies.service.js";

/** Mounted at /api/societies. ADMIN only; admins run every society (docs/API_CONTRACT.md §4 Societies, D028). */
export function societiesRouter(deps: { service: SocietiesService; requireAuth: RequestHandler }): Router {
  const controller = createSocietiesController(deps);
  const router = Router();

  router.use(noStore, deps.requireAuth, requireRole("ADMIN"));
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);

  return router;
}
