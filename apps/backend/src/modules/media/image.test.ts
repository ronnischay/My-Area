import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hasMetadata, makeJpeg, makePng, makeTruncatedJpeg, makeWebp } from "../../../test/helpers/images.js";
import { DamagedImageError, detectFormat, MAX_SIDE_PX, processPhoto, UnsupportedImageError } from "./image.js";

const info = async (bytes: Buffer) => {
  const { format, width, height, orientation } = await sharp(bytes).metadata();
  return { format, width, height, orientation };
};

describe("detectFormat", () => {
  it("reads the real format from the content", async () => {
    expect(await detectFormat(makeJpeg())).toBe("jpeg");
    expect(await detectFormat(makePng())).toBe("png");
    expect(await detectFormat(makeWebp())).toBe("webp");
    expect(await detectFormat(Buffer.from("%PDF-1.7 not an image"))).toBeNull();
  });
});

describe("processPhoto", () => {
  it("stores a JPEG without any metadata", async () => {
    const input = makeJpeg();
    expect(await hasMetadata(input)).toBe(true);

    const output = await processPhoto(input, "image/jpeg");

    expect(await hasMetadata(output)).toBe(false);
    expect(await info(output)).toEqual({ format: "jpeg", width: 1200, height: 900, orientation: undefined });
  });

  it("turns a phone photo upright instead of keeping the orientation tag", async () => {
    expect(await info(await processPhoto(makeJpeg({ orientation: 6 }), "image/jpeg"))).toEqual({
      format: "jpeg",
      width: 900,
      height: 1200,
      orientation: undefined,
    });
  });

  it(`shrinks to ${MAX_SIDE_PX} px on the longest side, never enlarges`, async () => {
    expect(await info(await processPhoto(makeJpeg({ large: true }), "image/jpeg"))).toMatchObject({ width: 2000, height: 1500 });
    expect(await info(await processPhoto(makeWebp(), "image/webp"))).toMatchObject({ width: 800, height: 600 });
  });

  it("converts PNG and WebP to JPEG, with transparency on white", async () => {
    const png = await processPhoto(makePng(), "image/png");
    expect(await info(png)).toMatchObject({ format: "jpeg", width: 640, height: 480 });
    expect(await hasMetadata(png)).toBe(false);
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]].every((v) => (v ?? 0) > 245)).toBe(true);

    const webp = await processPhoto(makeWebp(), "image/webp");
    expect((await info(webp)).format).toBe("jpeg");
    expect(await hasMetadata(webp)).toBe(false);
  });

  it("refuses other formats and a declared type that doesn't match the content", async () => {
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).gif().toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await expect(processPhoto(gif, "image/gif")).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(processPhoto(svg, "image/jpeg")).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(processPhoto(makePng(), "image/jpeg")).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(processPhoto(Buffer.from("not an image"), "image/jpeg")).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("refuses a truncated image", async () => {
    await expect(processPhoto(makeTruncatedJpeg(), "image/jpeg")).rejects.toBeInstanceOf(DamagedImageError);
  });
});
