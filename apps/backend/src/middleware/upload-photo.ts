import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { MAX_PHOTO_BYTES, PHOTO_FIELD } from "../modules/media/media.constants.js";

const parser = multer({
  // Kept in memory (≤ 5 MB) until it has been checked; nothing touches the disk before that.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 10, fieldSize: 10_000, parts: 12, headerPairs: 100 },
}).single(PHOTO_FIELD);

const photoField = (message: string) => ({ fieldErrors: { [PHOTO_FIELD]: [message] } });

/**
 * Parses `multipart/form-data` with at most one file in the `photo` field, into `req.body` and `req.file`.
 * Requests of any other content type pass through untouched. Mount after requireAuth.
 */
export const uploadPhoto: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new AppError(413, "FILE_TOO_LARGE", "The photo must be 5 MB or smaller.", photoField("The photo must be 5 MB or smaller.")));
        return;
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        next(new AppError(400, "VALIDATION_ERROR", "Attach one photo.", photoField("Attach one photo.")));
        return;
      }
      next(new AppError(400, "VALIDATION_ERROR", "The form has too many or too large fields."));
      return;
    }
    // busboy parse errors (malformed or cut-off multipart body) are the client's fault.
    next(new AppError(400, "VALIDATION_ERROR", "The upload could not be read. Please try again."));
  });
};
