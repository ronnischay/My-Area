import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalMediaStorage } from "./media-storage.js";

describe("createLocalMediaStorage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "myarea-media-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("saves, reads and deletes a file under the upload directory", async () => {
    const storage = createLocalMediaStorage(dir);
    await storage.save("reports/a.jpg", Buffer.from("photo"));

    expect(await storage.read("reports/a.jpg")).toEqual(Buffer.from("photo"));
    expect(await readdir(join(dir, "reports"))).toEqual(["a.jpg"]); // no temp file left behind

    await storage.delete("reports/a.jpg");
    expect(await storage.read("reports/a.jpg")).toBeNull();
    await storage.delete("reports/a.jpg"); // deleting twice is fine
  });

  it("replaces a file in one step when the same key is saved again", async () => {
    const storage = createLocalMediaStorage(dir);
    await storage.save("reports/a.jpg", Buffer.from("first"));
    await storage.save("reports/a.jpg", Buffer.from("second"));
    expect(await storage.read("reports/a.jpg")).toEqual(Buffer.from("second"));
  });

  it("refuses keys outside the upload directory", async () => {
    const storage = createLocalMediaStorage(dir);
    await expect(storage.save("../escape.jpg", Buffer.from("x"))).rejects.toThrow(/escapes/);
    await expect(storage.read("/etc/passwd")).rejects.toThrow(/escapes/);
    await expect(storage.delete("reports/../../x")).rejects.toThrow(/escapes/);
  });
});
