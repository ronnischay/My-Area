import { describe, expect, it } from "vitest";
import {
  GPS_MARKER,
  makeJpeg,
  makeLosslessWebp,
  makePng,
  makeSimpleWebp,
  makeWebp,
} from "../../../test/helpers/images.js";
import { DamagedImageError, detectImageType, exifOrientation, stripImageMetadata } from "./image.js";

const hasGps = (bytes: Buffer) => bytes.includes(Buffer.from(GPS_MARKER, "latin1"));

/** JPEG markers in order, stopping at SOS (what a decoder reads before the image data). */
function jpegMarkers(bytes: Buffer): number[] {
  const markers: number[] = [];
  let offset = 2;
  while (offset < bytes.length) {
    const marker = bytes.readUInt8(offset + 1);
    markers.push(marker);
    if (marker === 0xda) break;
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return markers;
}

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by their signature", () => {
    expect(detectImageType(makeJpeg())).toBe("image/jpeg");
    expect(detectImageType(makePng())).toBe("image/png");
    expect(detectImageType(makeWebp())).toBe("image/webp");
  });

  it("rejects everything else", () => {
    expect(detectImageType(Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"))).toBeNull();
    expect(detectImageType(Buffer.from("%PDF-1.7\n", "latin1"))).toBeNull();
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageType(Buffer.from("RIFF\0\0\0\0WAVE", "latin1"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("stripImageMetadata: JPEG", () => {
  it("removes EXIF, XMP, ICC and comments but keeps JFIF and the image data", () => {
    const input = makeJpeg({ width: 1200, height: 900 });
    expect(hasGps(input)).toBe(true);

    const { bytes, width, height } = stripImageMetadata(input, "image/jpeg");

    expect({ width, height }).toEqual({ width: 1200, height: 900 });
    expect(hasGps(bytes)).toBe(false);
    expect(jpegMarkers(bytes)).toEqual([0xe0, 0xdb, 0xc0, 0xda]);
    // Same image data from SOS to EOI.
    const tail = (b: Buffer) => b.subarray(b.indexOf(Buffer.from([0xff, 0xda]))).toString("hex");
    expect(tail(bytes)).toBe(tail(input));
    expect(bytes.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("keeps only the orientation so rotated phone photos stay upright, with display size swapped", () => {
    const { bytes, width, height } = stripImageMetadata(makeJpeg({ width: 4032, height: 3024, orientation: 6 }), "image/jpeg");

    expect({ width, height }).toEqual({ width: 3024, height: 4032 });
    expect(hasGps(bytes)).toBe(false);
    expect(jpegMarkers(bytes)).toEqual([0xe0, 0xe1, 0xdb, 0xc0, 0xda]);
    const app1 = bytes.subarray(bytes.indexOf(Buffer.from([0xff, 0xe1])) + 4);
    expect(exifOrientation(app1)).toBe(6);
  });

  it("does not add an orientation block for upright photos or files without EXIF", () => {
    expect(jpegMarkers(stripImageMetadata(makeJpeg({ orientation: 1 }), "image/jpeg").bytes)).not.toContain(0xe1);
    const plain = makeJpeg({ withMetadata: false });
    expect(stripImageMetadata(plain, "image/jpeg").bytes).toEqual(plain);
  });

  it("drops data appended after the end of the image (embedded previews with their own EXIF)", () => {
    const trailer = makeJpeg({ width: 160, height: 120 });
    const { bytes } = stripImageMetadata(makeJpeg({ trailer }), "image/jpeg");
    expect(hasGps(bytes)).toBe(false);
    expect(bytes.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("rejects truncated or broken files", () => {
    const jpeg = makeJpeg();
    const sos = jpeg.indexOf(Buffer.from([0xff, 0xda]));
    expect(() => stripImageMetadata(jpeg.subarray(0, 40), "image/jpeg")).toThrow(DamagedImageError);
    expect(() => stripImageMetadata(jpeg.subarray(0, sos), "image/jpeg")).toThrow(DamagedImageError);
    expect(() => stripImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg")).toThrow(DamagedImageError);
    expect(() => stripImageMetadata(makeJpeg({ width: 0 }), "image/jpeg")).toThrow(DamagedImageError);
  });
});

describe("stripImageMetadata: PNG", () => {
  it("removes eXIf, text and time chunks and reads the size from IHDR", () => {
    const { bytes, width, height } = stripImageMetadata(makePng({ width: 640, height: 480 }), "image/png");

    expect({ width, height }).toEqual({ width: 640, height: 480 });
    expect(hasGps(bytes)).toBe(false);
    expect(bytes.includes(Buffer.from("tIME"))).toBe(false);
    expect(bytes).toEqual(makePng({ width: 640, height: 480, withMetadata: false }));
  });

  it("rejects a PNG that doesn't start with IHDR or is cut short", () => {
    const png = makePng();
    expect(() => stripImageMetadata(png.subarray(0, 30), "image/png")).toThrow(DamagedImageError);
    const noHeader = Buffer.concat([png.subarray(0, 8), png.subarray(33)]);
    expect(() => stripImageMetadata(noHeader, "image/png")).toThrow(DamagedImageError);
  });
});

describe("stripImageMetadata: WebP", () => {
  it("removes EXIF and XMP chunks, clears their VP8X flags and fixes the RIFF size", () => {
    const { bytes, width, height } = stripImageMetadata(makeWebp({ width: 800, height: 600 }), "image/webp");

    expect({ width, height }).toEqual({ width: 800, height: 600 });
    expect(hasGps(bytes)).toBe(false);
    expect(bytes).toEqual(makeWebp({ width: 800, height: 600, withMetadata: false }));
    expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
  });

  it("reads the size of simple lossy and lossless files", () => {
    expect(stripImageMetadata(makeSimpleWebp(320, 240), "image/webp")).toMatchObject({ width: 320, height: 240 });
    expect(stripImageMetadata(makeLosslessWebp(100, 50), "image/webp")).toMatchObject({ width: 100, height: 50 });
  });

  it("rejects a RIFF size larger than the file", () => {
    const webp = makeWebp();
    expect(() => stripImageMetadata(webp.subarray(0, webp.length - 10), "image/webp")).toThrow(DamagedImageError);
  });
});
