import sharp from "sharp";

/**
 * Uploaded photos are decoded and re-encoded with sharp (owner, 2026-10-30): that rejects fake or
 * broken files, turns phone photos upright, removes all metadata (EXIF incl. GPS, XMP, comments) and
 * stores every photo as a JPEG of at most 2000 px on its longest side.
 */

/** Formats residents may upload. Anything else sharp can read (GIF, SVG, HEIC, TIFF…) is refused. */
export const ACCEPTED_FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export type AcceptedMimeType = (typeof ACCEPTED_FORMATS)[keyof typeof ACCEPTED_FORMATS];

export const MAX_SIDE_PX = 2000;
const JPEG_QUALITY = 80;
/** Refuses "decompression bombs": a small file that would expand to a huge image (8000 × 5000). */
const MAX_INPUT_PIXELS = 40_000_000;

/** Not a JPEG, PNG or WebP, or not what the browser said it was. */
export class UnsupportedImageError extends Error {
  override name = "UnsupportedImageError";
}

/** A JPEG, PNG or WebP whose image data can't be decoded. */
export class DamagedImageError extends Error {
  override name = "DamagedImageError";
}

/** The real format from the file's content; null when sharp can't read it at all. */
export async function detectFormat(bytes: Buffer): Promise<string | null> {
  try {
    return (await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format ?? null;
  } catch {
    return null;
  }
}

/**
 * Checks `bytes` against the declared MIME type and returns the photo to store: upright, no metadata,
 * JPEG, longest side ≤ MAX_SIDE_PX (never enlarged). Transparent PNG/WebP areas become white.
 */
export async function processPhoto(bytes: Buffer, declaredMimeType: string): Promise<Buffer> {
  const format = await detectFormat(bytes);
  const mimeType = format && format in ACCEPTED_FORMATS ? ACCEPTED_FORMATS[format as keyof typeof ACCEPTED_FORMATS] : null;
  if (!mimeType || mimeType !== declaredMimeType) throw new UnsupportedImageError(`not an accepted image (${format ?? "unknown"})`);

  try {
    return await sharp(bytes, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // applies the EXIF orientation, then the tag is gone with the rest of the metadata
      .resize({ width: MAX_SIDE_PX, height: MAX_SIDE_PX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer(); // sharp writes no metadata unless asked to (withMetadata), so none is kept
  } catch (err) {
    throw new DamagedImageError(err instanceof Error ? err.message : "image could not be decoded");
  }
}
