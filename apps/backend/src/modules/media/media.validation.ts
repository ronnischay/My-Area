import { AppError } from "../../lib/errors.js";
import { DamagedImageError, detectImageType, EXTENSIONS, IMAGE_MIME_TYPES, type ImageMimeType, stripImageMetadata } from "./image.js";

/** The parts of a multer file the app uses. */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** A photo that passed every check, with its metadata already removed. Ready to store. */
export interface PreparedPhoto {
  bytes: Buffer;
  mimeType: ImageMimeType;
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
  originalFilename: string | null;
}

const photoError = (status: number, code: "UNSUPPORTED_MEDIA_TYPE" | "VALIDATION_ERROR", message: string) =>
  new AppError(status, code, message, { fieldErrors: { photo: [message] } });

/**
 * Server-side checks for an uploaded photo (the browser's checks are only a convenience):
 * the declared type must be allowed AND match the file's real signature, so a renamed file is refused.
 */
export function preparePhoto(file: UploadedFile): PreparedPhoto {
  const detected = detectImageType(file.buffer);
  if (!detected || detected !== file.mimetype || !(IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw photoError(415, "UNSUPPORTED_MEDIA_TYPE", "Use a JPEG, PNG or WebP photo.");
  }

  let clean;
  try {
    clean = stripImageMetadata(file.buffer, detected);
  } catch (err) {
    if (err instanceof DamagedImageError) throw photoError(400, "VALIDATION_ERROR", "This photo seems damaged. Try another one.");
    throw err;
  }

  return {
    bytes: clean.bytes,
    mimeType: detected,
    extension: EXTENSIONS[detected],
    sizeBytes: clean.bytes.length,
    width: clean.width,
    height: clean.height,
    originalFilename: sanitizeFilename(file.originalname),
  };
}

/** Last path segment, no control characters, at most 255 characters. Stored for reference only, never used as a path. */
export function sanitizeFilename(name: string): string | null {
  // eslint-disable-next-line no-control-regex
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return base ? base.slice(0, 255) : null;
}
