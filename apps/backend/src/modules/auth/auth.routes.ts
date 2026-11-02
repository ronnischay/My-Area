import { type RequestHandler, Router } from "express";
import { noStore } from "../../middleware/no-store.js";
import { createAuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";
import type { PasswordResetService } from "./password-reset.service.js";

/** Mounted at /api/auth (docs/API_CONTRACT.md §4 Auth). */
export function authRouter(deps: {
  service: AuthService;
  passwordReset: PasswordResetService;
  requireAuth: RequestHandler;
  secureCookies: boolean;
}): Router {
  const controller = createAuthController(deps);
  const router = Router();

  router.use(noStore);
  router.post("/login", controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", deps.requireAuth, controller.me);
  router.post("/invites/lookup", controller.lookupInvite);
  router.post("/invites/accept", controller.acceptInvite);
  router.post("/password-reset/request", controller.requestPasswordReset);
  router.post("/password-reset/lookup", controller.lookupPasswordReset);
  router.post("/password-reset/confirm", controller.confirmPasswordReset);

  return router;
}
