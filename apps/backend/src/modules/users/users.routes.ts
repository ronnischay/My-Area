import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { requireRole } from "../../middleware/require-role.js";
import type { SocietiesService } from "../societies/societies.service.js";
import { createUsersController, memberScope } from "./users.controller.js";
import type { UsersService } from "./users.service.js";

/**
 * Mounted at /api/societies/:societyId/members (docs/API_CONTRACT.md §4 Society members, D028).
 * ADMIN: any existing society. MANAGER: their own society only, inviting residents only (checked in
 * the service); another society is 404, like an unknown one. Changing a member is ADMIN only.
 */
export function membersRouter(deps: { service: UsersService; societies: SocietiesService; requireAuth: RequestHandler }): Router {
  const controller = createUsersController(deps);
  const router = Router({ mergeParams: true });

  router.use(noStore, deps.requireAuth, requireRole("ADMIN", "MANAGER"), memberScope(deps.societies));
  router.get("/", controller.list);
  router.post("/", controller.invite);
  router.post("/:id/invite", controller.resendInvite);
  router.patch("/:id", requireRole("ADMIN"), controller.update);

  return router;
}
