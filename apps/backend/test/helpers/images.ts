import sharp from "sharp";

/**
 * Real, decodable test photos made with sharp when the test file loads (top-level await). Each one
 * carries EXIF metadata containing GPS_MARKER, so tests can prove the stored copy has none.
 */

/** Text planted in the EXIF of every fixture; must never survive processing. */
export const GPS_MARKER = "GPS 28.4595N 77.0266E";

const exif = { IFD0: { ImageDescription: GPS_MARKER, Make: "PhoneCo" } };
const canvas = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 7, g: 171, b: 18 } } });

/** 1200 × 900 JPEG (landscape pixels). */
const JPEG = await canvas(1200, 900).jpeg().withExif(exif).toBuffer();
/** The same pixels tagged "rotate 90°" (EXIF orientation 6), like a phone held upright: displays 900 × 1200. */
const JPEG_ROTATED = await canvas(1200, 900).jpeg().withExif(exif).withMetadata({ orientation: 6 }).toBuffer();
/** 4000 × 3000: bigger than the 2000 px limit. */
const JPEG_LARGE = await canvas(4000, 3000).jpeg().withExif(exif).toBuffer();
const PNG = await sharp({ create: { width: 640, height: 480, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .png()
  .withExif(exif)
  .toBuffer();
const WEBP = await canvas(800, 600).webp().withExif(exif).toBuffer();

export function makeJpeg(options: { orientation?: 6; large?: boolean } = {}): Buffer {
  return Buffer.from(options.orientation === 6 ? JPEG_ROTATED : options.large ? JPEG_LARGE : JPEG);
}

/** Transparent 640 × 480 PNG. */
export function makePng(): Buffer {
  return Buffer.from(PNG);
}

export function makeWebp(): Buffer {
  return Buffer.from(WEBP);
}

/** A real JPEG cut off halfway through its image data. */
export function makeTruncatedJpeg(): Buffer {
  return Buffer.from(JPEG.subarray(0, Math.floor(JPEG.length * 0.6)));
}

/** Whether `bytes` still carries any EXIF block or the planted marker. */
export async function hasMetadata(bytes: Buffer): Promise<boolean> {
  return bytes.includes(Buffer.from(GPS_MARKER)) || (await sharp(bytes).metadata()).exif !== undefined;
}
