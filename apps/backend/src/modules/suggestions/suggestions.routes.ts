import { type RequestHandler, Router } from "express";
import { z } from "zod";
import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import { parseInput } from "../../lib/validation.js";
import { getAuth } from "../../middleware/require-auth.js";
import { noStore } from "../../middleware/no-store.js";
import { getSocietyAuth, requireSociety } from "../../middleware/require-society.js";
import { SuggestionError, type SuggestionProvider } from "../../providers/suggestion.provider.js";
import { uploadPhoto } from "../../middleware/upload-photo.js";
import { createLoginRateLimiter } from "../auth/login-rate-limiter.js";
import { preparePhoto } from "../media/media.validation.js";

/** 10 suggestions per user per 10 minutes: the free Gemini quota is shared by the whole society. */
export const SUGGESTION_LIMIT = 10;
const SUGGESTION_WINDOW_MS = 10 * 60 * 1000;

/** JSON or multipart. Needs a photo, or a description of 10+ characters, to work from. */
const SuggestBodySchema = z
  .object({
    title: z.string().trim().max(120, "Title must be at most 120 characters").optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be at most 2000 characters")
      .optional()
      .transform((d) => d || undefined),
    photo: z.custom<Express.Multer.File>().optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.photo && (input.description?.length ?? 0) < 10) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Add a photo or write at least 10 characters first" });
    }
  });

interface Deps {
  provider: SuggestionProvider | null;
  requireAuth: RequestHandler;
  logger: Logger;
  clock: Clock;
}

/** GET /api/features: which optional features this server has switched on (for the UI). */
export function featuresRouter({ provider, requireAuth }: Pick<Deps, "provider" | "requireAuth">): Router {
  const router = Router();
  router.get("/", noStore, requireAuth, (req, res) => {
    getAuth(req);
    res.json({ data: { aiSuggestions: provider !== null } });
  });
  return router;
}

/**
 * POST /api/reports/suggest (docs/features/ai-suggestions.md). Nothing is stored; the resident
 * decides whether to use the answer. Mounted before the reports router so "suggest" isn't an id.
 */
export function suggestionsRouter({ provider, requireAuth, logger, clock }: Deps): Router {
  // The fixed-window counter from login, counting every request rather than failures.
  const limiter = createLoginRateLimiter({ maxFailures: SUGGESTION_LIMIT, windowMs: SUGGESTION_WINDOW_MS });
  const router = Router();

  router.post("/", noStore, requireAuth, requireSociety, uploadPhoto, async (req, res) => {
    const input = parseInput(SuggestBodySchema, { ...req.body, photo: req.file });
    // Same checks and metadata stripping as a report photo: Google never gets GPS or camera data.
    const photo = input.photo ? await preparePhoto(input.photo) : undefined;
    if (!provider) throw new AppError(503, "SUGGESTIONS_UNAVAILABLE", "Suggestions aren't switched on for this society.");

    const { userId } = getSocietyAuth(req);
    const retryAfter = limiter.retryAfterSeconds(userId, clock());
    if (retryAfter > 0) {
      throw new AppError(429, "RATE_LIMITED", "You've asked for a lot of suggestions. Please try again in a few minutes.", undefined, {
        "Retry-After": String(retryAfter),
      });
    }
    limiter.recordFailure(userId, clock());

    try {
      res.json({
        data: await provider.suggest({
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(photo ? { photo: { mimeType: photo.mimeType, bytes: photo.bytes } } : {}),
        }),
      });
    } catch (err) {
      if (!(err instanceof SuggestionError)) throw err;
      // The reason only (never the resident's text or the key).
      logger.warn("suggestion failed", { userId, reason: err.message });
      throw new AppError(502, "SUGGESTION_FAILED", "Couldn't get a suggestion right now. You can carry on without it.");
    }
  });

  return router;
}
