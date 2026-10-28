import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireRole } from "../../middleware/require-role.js";
import { requireSociety } from "../../middleware/require-society.js";
import { createUsersController } from "./users.controller.js";
import type { UsersService } from "./users.service.js";

/** Mounted at /api/admin/users. ADMIN with a society only (docs/API_CONTRACT.md §4 Society members). */
export function usersRouter(deps: { service: UsersService; requireAuth: RequestHandler }): Router {
  const controller = createUsersController(deps);
  const router = Router();

  router.use(noStore, deps.requireAuth, requireRole("ADMIN"), requireSociety);
  router.get("/", controller.list);
  router.post("/", controller.invite);
  router.post("/:id/invite", controller.resendInvite);
  router.patch("/:id", controller.update);

  return router;
}
