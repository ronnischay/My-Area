import { describe, expect, it } from "vitest";
import { hasMetadata, makeJpeg, makeTruncatedJpeg } from "../../../test/helpers/images.js";
import { AppError } from "../../lib/errors.js";
import { preparePhoto } from "./media.validation.js";

describe("preparePhoto", () => {
  it("returns a clean JPEG ready to store", async () => {
    const photo = await preparePhoto({ buffer: makeJpeg(), mimetype: "image/jpeg" });
    expect(photo).toMatchObject({ mimeType: "image/jpeg", extension: "jpg" });
    expect(await hasMetadata(photo.bytes)).toBe(false);
  });

  it("maps refusals to the API's errors", async () => {
    await expect(preparePhoto({ buffer: makeJpeg(), mimetype: "image/pjpeg" })).rejects.toMatchObject({ status: 415, message: "Use a JPEG, PNG or WebP photo." });
    await expect(preparePhoto({ buffer: makeTruncatedJpeg(), mimetype: "image/jpeg" })).rejects.toBeInstanceOf(AppError);
    await expect(preparePhoto({ buffer: makeTruncatedJpeg(), mimetype: "image/jpeg" })).rejects.toMatchObject({ status: 400 });
  });
});
