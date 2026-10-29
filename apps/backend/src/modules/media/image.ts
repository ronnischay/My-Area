/**
 * Byte-level handling of uploaded photos, without decoding or re-encoding them (D021):
 * detect the real format from the file signature, remove metadata (EXIF incl. GPS, XMP, comments,
 * text chunks) and read the pixel size. The image data itself is copied unchanged.
 */

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const EXTENSIONS: Record<ImageMimeType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface CleanImage {
  bytes: Buffer;
  /** Display size: already swapped for JPEG orientations that rotate by 90°. */
  width: number;
  height: number;
}

/** The file claims to be a supported image but its structure is broken or truncated. */
export class DamagedImageError extends Error {
  override name = "DamagedImageError";
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The real type from the first bytes, or null when it isn't JPEG, PNG or WebP. */
export function detectImageType(bytes: Buffer): ImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function stripImageMetadata(bytes: Buffer, type: ImageMimeType): CleanImage {
  try {
    if (type === "image/jpeg") return cleanJpeg(bytes);
    if (type === "image/png") return cleanPng(bytes);
    return cleanWebp(bytes);
  } catch (err) {
    // Buffer reads past the end throw RangeError; report every structural problem the same way.
    if (err instanceof DamagedImageError) throw err;
    if (err instanceof RangeError) throw new DamagedImageError("image is truncated");
    throw err;
  }
}

function assertSize(width: number, height: number): void {
  if (!(width > 0 && height > 0)) throw new DamagedImageError("image has no size");
}

// --- JPEG ----------------------------------------------------------------------

/** SOFn markers carry the frame size. C4 (DHT), C8 (JPG) and CC (DAC) share the range but aren't frames. */
const isStartOfFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
/** APP1–APP15 (EXIF, XMP, ICC, maker data…) and COM. APP0 (JFIF) is kept. */
const isMetadata = (marker: number) => (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;

function cleanJpeg(bytes: Buffer): CleanImage {
  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let orientation = 1;
  let width = 0;
  let height = 0;
  let sawScan = false;
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new DamagedImageError("bad JPEG segment");
    let markerAt = offset + 1;
    while (bytes[markerAt] === 0xff) markerAt += 1; // fill bytes
    const marker = bytes.readUInt8(markerAt);
    const segmentStart = markerAt - 1;

    if (marker === 0xd9) {
      // End of image. Anything after it (appended preview/depth images with their own EXIF) is dropped.
      kept.push(bytes.subarray(segmentStart, markerAt + 1));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(bytes.subarray(segmentStart, markerAt + 1));
      offset = markerAt + 1;
      continue;
    }

    const length = bytes.readUInt16BE(markerAt + 1);
    const end = markerAt + 1 + length;
    if (length < 2 || end > bytes.length) throw new DamagedImageError("bad JPEG segment length");
    const data = bytes.subarray(markerAt + 3, end);

    if (marker === 0xe1) orientation = exifOrientation(data) ?? orientation;
    if (isStartOfFrame(marker)) {
      height = data.readUInt16BE(1);
      width = data.readUInt16BE(3);
    }
    if (!isMetadata(marker)) kept.push(bytes.subarray(segmentStart, end));
    offset = end;

    if (marker === 0xda) {
      // Entropy-coded data follows. Inside it 0xFF is always followed by 0x00 (stuffing) or RSTn,
      // so the next 0xFF + anything else is a real marker (another segment or EOI).
      sawScan = true;
      let scanEnd = offset;
      while (scanEnd + 1 < bytes.length) {
        const next = bytes.readUInt8(scanEnd + 1);
        if (bytes[scanEnd] === 0xff && next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break;
        scanEnd += 1;
      }
      if (scanEnd + 1 >= bytes.length) scanEnd = bytes.length; // no EOI: keep the data as-is
      kept.push(bytes.subarray(offset, scanEnd));
      offset = scanEnd;
    }
  }

  if (!sawScan) throw new DamagedImageError("JPEG has no image data");
  assertSize(width, height);
  // Keep only the rotation, so phone photos still display upright.
  if (orientation !== 1) {
    const afterApp0 = kept[1] && kept[1][1] === 0xe0 ? 2 : 1;
    kept.splice(afterApp0, 0, orientationSegment(orientation));
  }
  const rotated = orientation >= 5;
  return { bytes: Buffer.concat(kept), width: rotated ? height : width, height: rotated ? width : height };
}

/** The EXIF Orientation tag (0x0112) from an APP1 payload, if present and valid (1–8). */
export function exifOrientation(app1: Buffer): number | null {
  if (app1.length < 14 || app1.toString("latin1", 0, 6) !== "Exif\0\0") return null;
  const tiff = app1.subarray(6);
  const order = tiff.toString("latin1", 0, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  const u16 = (at: number) => (le ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (le ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  try {
    const ifd = u32(4);
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : null;
      }
    }
  } catch {
    return null; // a broken EXIF block is dropped anyway
  }
  return null;
}

/** A minimal APP1 EXIF segment containing only the Orientation tag. */
export function orientationSegment(orientation: number): Buffer {
  const payload = Buffer.alloc(32);
  payload.write("Exif\0\0", 0, "latin1");
  payload.write("MM", 6, "latin1"); // big-endian TIFF
  payload.writeUInt16BE(0x002a, 8);
  payload.writeUInt32BE(8, 10); // IFD0 right after the header
  payload.writeUInt16BE(1, 14); // one entry
  payload.writeUInt16BE(0x0112, 16); // Orientation
  payload.writeUInt16BE(3, 18); // SHORT
  payload.writeUInt32BE(1, 20); // count
  payload.writeUInt16BE(orientation, 24);
  // bytes 26–27 padding, 28–31 next IFD = 0
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

// --- PNG -----------------------------------------------------------------------

/** Ancillary chunks that can carry personal data: EXIF, text (incl. XMP in iTXt) and timestamps. */
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function cleanPng(bytes: Buffer): CleanImage {
  const kept: Buffer[] = [bytes.subarray(0, 8)];
  let width = 0;
  let height = 0;
  let offset = 8;
  let first = true;

  for (;;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new DamagedImageError("bad PNG chunk length");
    if (first) {
      if (type !== "IHDR") throw new DamagedImageError("PNG must start with IHDR");
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      first = false;
    }
    if (!PNG_METADATA_CHUNKS.has(type)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === "IEND") break;
  }

  assertSize(width, height);
  return { bytes: Buffer.concat(kept), width, height };
}

// --- WebP ----------------------------------------------------------------------

const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

function cleanWebp(bytes: Buffer): CleanImage {
  const riffEnd = 8 + bytes.readUInt32LE(4);
  if (riffEnd > bytes.length) throw new DamagedImageError("bad RIFF size");
  const kept: Buffer[] = [];
  let width = 0;
  let height = 0;
  let offset = 12;

  while (offset + 8 <= riffEnd) {
    const fourcc = bytes.toString("latin1", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const end = dataStart + size + (size % 2); // chunks are padded to an even length
    if (dataStart + size > riffEnd) throw new DamagedImageError("bad WebP chunk length");
    const chunk = Buffer.from(bytes.subarray(offset, Math.min(end, riffEnd)));

    if (fourcc === "VP8X") {
      chunk[8] = chunk.readUInt8(8) & ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP);
      width = chunk.readUIntLE(12, 3) + 1;
      height = chunk.readUIntLE(15, 3) + 1;
    } else if (fourcc === "VP8 " && width === 0) {
      // Lossy key frame: 3-byte frame tag, start code 9D 01 2A, then 14-bit sizes.
      if (chunk.readUIntBE(11, 3) !== 0x9d012a) throw new DamagedImageError("bad VP8 start code");
      width = chunk.readUInt16LE(14) & 0x3fff;
      height = chunk.readUInt16LE(16) & 0x3fff;
    } else if (fourcc === "VP8L" && width === 0) {
      if (chunk.readUInt8(8) !== 0x2f) throw new DamagedImageError("bad VP8L signature");
      const bits = chunk.readUInt32LE(9);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
    if (fourcc !== "EXIF" && fourcc !== "XMP ") kept.push(chunk);
    offset = end;
  }

  assertSize(width, height);
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return { bytes: Buffer.concat([header, body]), width, height };
}
