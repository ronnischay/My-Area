import { describe, expect, it } from "vitest";
import { makeJpeg } from "../../../test/helpers/images.js";
import { AppError } from "../../lib/errors.js";
import { preparePhoto, sanitizeFilename } from "./media.validation.js";

describe("preparePhoto", () => {
  it("returns the cleaned bytes with type, extension, size and dimensions", () => {
    const photo = preparePhoto({ buffer: makeJpeg({ width: 1600, height: 1200 }), mimetype: "image/jpeg", originalname: "IMG_2041.JPG" });
    expect(photo).toMatchObject({ mimeType: "image/jpeg", extension: "jpg", width: 1600, height: 1200, originalFilename: "IMG_2041.JPG" });
    expect(photo.sizeBytes).toBe(photo.bytes.length);
  });

  it("refuses a declared type that isn't allowed even when the bytes are a JPEG", () => {
    const attempt = () => preparePhoto({ buffer: makeJpeg(), mimetype: "image/pjpeg", originalname: "a.jpg" });
    expect(attempt).toThrow(AppError);
    expect(attempt).toThrow("Use a JPEG, PNG or WebP photo.");
  });
});

describe("sanitizeFilename", () => {
  it("keeps only the last path segment without control characters", () => {
    expect(sanitizeFilename("C:\\Users\\meera\\Pictures\\pothole.jpg")).toBe("pothole.jpg");
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("gate\u0000\n2.jpg")).toBe("gate2.jpg");
    expect(sanitizeFilename(`${"a".repeat(300)}.jpg`)).toHaveLength(255);
  });

  it("returns null when nothing is left", () => {
    expect(sanitizeFilename("")).toBeNull();
    expect(sanitizeFilename("folder/")).toBeNull();
    expect(sanitizeFilename("\u0001\u0002")).toBeNull();
  });
});
