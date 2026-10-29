/**
 * Builds small JPEG/PNG/WebP files byte by byte, with the metadata a phone camera adds. They are
 * structurally valid (what src/modules/media/image.ts parses), not decodable pictures.
 */

const u16be = (n: number) => Buffer.from([(n >> 8) & 0xff, n & 0xff]);
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

/** Marks a file as carrying location data, so tests can assert it is gone. */
export const GPS_MARKER = "GPS 28.4595N 77.0266E";

function jpegSegment(marker: number, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0xff, marker]), u16be(payload.length + 2), payload]);
}

/** APP1 EXIF with Orientation (little-endian TIFF) followed by a fake GPS block. */
function exifApp1(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(0x2a, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  return jpegSegment(0xe1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, Buffer.from(GPS_MARKER, "latin1")]));
}

export function makeJpeg(
  options: { width?: number; height?: number; orientation?: number; withMetadata?: boolean; trailer?: Buffer } = {},
): Buffer {
  const { width = 1200, height = 900, orientation = 1, withMetadata = true, trailer } = options;
  const jfif = jpegSegment(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1"));
  const dqt = jpegSegment(0xdb, Buffer.alloc(65, 1));
  const sof = jpegSegment(0xc0, Buffer.concat([Buffer.from([8]), u16be(height), u16be(width), Buffer.from([1, 1, 0x11, 0])]));
  const sos = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
  // Entropy data with byte stuffing (FF 00) and a restart marker, which must not end the scan.
  const scan = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78]);
  const metadata = withMetadata
    ? [
        exifApp1(orientation),
        jpegSegment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${GPS_MARKER}</x:xmpmeta>`, "latin1")),
        jpegSegment(0xe2, Buffer.from("ICC_PROFILE\0", "latin1")),
        jpegSegment(0xfe, Buffer.from(`Comment ${GPS_MARKER}`, "latin1")),
      ]
    : [];
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jfif,
    ...metadata,
    dqt,
    sof,
    sos,
    scan,
    Buffer.from([0xff, 0xd9]),
    ...(trailer ? [trailer] : []),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  // CRCs aren't checked by the parser; a fixed value keeps the builder simple.
  return Buffer.concat([u16be(0), u16be(data.length), Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
}

export function makePng(options: { width?: number; height?: number; withMetadata?: boolean } = {}): Buffer {
  const { width = 640, height = 480, withMetadata = true } = options;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    ...(withMetadata
      ? [
          pngChunk("eXIf", Buffer.from(`MM\0*${GPS_MARKER}`, "latin1")),
          pngChunk("tEXt", Buffer.from(`Location\0${GPS_MARKER}`, "latin1")),
          pngChunk("iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${GPS_MARKER}`, "latin1")),
          pngChunk("tIME", Buffer.from([7, 234, 10, 28, 10, 0, 0])),
        ]
      : []),
    pngChunk("IDAT", Buffer.from([0x78, 0x9c, 1, 2, 3])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function webpChunk(fourcc: string, data: Buffer): Buffer {
  const pad = data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([Buffer.from(fourcc, "latin1"), u32le(data.length), data, pad]);
}

function riff(chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  return Buffer.concat([Buffer.from("RIFF", "latin1"), u32le(body.length + 4), Buffer.from("WEBP", "latin1"), body]);
}

/** Extended WebP (VP8X) with EXIF and XMP chunks around a lossy frame. */
export function makeWebp(options: { width?: number; height?: number; withMetadata?: boolean } = {}): Buffer {
  const { width = 800, height = 600, withMetadata = true } = options;
  const vp8x = Buffer.alloc(10);
  vp8x.writeUInt8(withMetadata ? 0x08 | 0x04 : 0, 0);
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  return riff([
    webpChunk("VP8X", vp8x),
    webpChunk("VP8 ", vp8Frame(width, height)),
    ...(withMetadata
      ? [webpChunk("EXIF", Buffer.from(`MM\0*${GPS_MARKER}`, "latin1")), webpChunk("XMP ", Buffer.from(`<x>${GPS_MARKER}</x>`, "latin1"))]
      : []),
  ]);
}

function vp8Frame(width: number, height: number): Buffer {
  const frame = Buffer.alloc(13);
  frame.writeUIntBE(0x9d012a, 3, 3);
  frame.writeUInt16LE(width, 6);
  frame.writeUInt16LE(height, 8);
  return frame;
}

/** Simple (lossy, VP8 only) WebP. */
export function makeSimpleWebp(width = 320, height = 240): Buffer {
  return riff([webpChunk("VP8 ", vp8Frame(width, height))]);
}

/** Lossless (VP8L) WebP. */
export function makeLosslessWebp(width = 100, height = 50): Buffer {
  const data = Buffer.alloc(6);
  data.writeUInt8(0x2f, 0);
  data.writeUInt32LE(((height - 1) << 14) | (width - 1), 1);
  return riff([webpChunk("VP8L", data)]);
}
