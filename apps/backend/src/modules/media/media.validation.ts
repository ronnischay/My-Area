import { AppError } from "../../lib/errors.js";
import { DamagedImageError, processPhoto, UnsupportedImageError } from "./image.js";

/** The parts of a multer file the app uses. */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

/** A photo that passed every check, cleaned and converted. Ready to store. Always a JPEG. */
export interface PreparedPhoto {
  bytes: Buffer;
  mimeType: "image/jpeg";
  extension: "jpg";
}

const photoError = (status: number, code: "UNSUPPORTED_MEDIA_TYPE" | "VALIDATION_ERROR", message: string) =>
  new AppError(status, code, message, { fieldErrors: { photo: [message] } });

/**
 * Server-side checks for an uploaded photo (the browser's checks are only a convenience): the
 * declared type must be allowed AND match the file's real content, so a renamed file is refused.
 * Size and file count are enforced earlier by the upload middleware (multer).
 */
export async function preparePhoto(file: UploadedFile): Promise<PreparedPhoto> {
  try {
    return { bytes: await processPhoto(file.buffer, file.mimetype), mimeType: "image/jpeg", extension: "jpg" };
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw photoError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPEG, PNG or WebP photo.");
    if (err instanceof DamagedImageError) throw photoError(400, "VALIDATION_ERROR", "This photo seems damaged. Try another one.");
    throw err;
  }
}
