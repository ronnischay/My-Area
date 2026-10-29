import { type RequestHandler, Router } from "express";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { getSocietyAuth, requireSociety } from "../../middleware/require-society.js";
import type { MediaStorage } from "../../providers/media-storage.js";
import type { MediaRepository } from "./media.repository.js";

const notFound = () => new AppError(404, "NOT_FOUND", "Photo not found");

/**
 * Mounted at /api/media. GET /:id streams a stored photo to a signed-in member of the report's
 * society; anyone else gets 404, exactly as for an unknown id (D021).
 */
export function mediaRouter(deps: {
  repository: MediaRepository;
  storage: MediaStorage;
  logger: Logger;
  requireAuth: RequestHandler;
}): Router {
  const router = Router();
  router.use(deps.requireAuth, requireSociety);

  router.get("/:id", async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const media = await deps.repository.findForSociety(getSocietyAuth(req).societyId, id);
    if (!media) throw notFound();

    const bytes = await deps.storage.read(media.providerPublicId);
    if (!bytes) {
      deps.logger.error("photo file missing from storage", { mediaId: id });
      throw notFound();
    }

    res.set({
      "Content-Type": media.mimeType,
      // Personal data: the browser may keep it, shared caches may not. Files never change once stored.
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Disposition": "inline",
      // The frontend on another localhost port (dev) is same-site; helmet's default same-origin would block it.
      "Cross-Origin-Resource-Policy": "same-site",
    });
    res.send(bytes);
  });

  return router;
}
