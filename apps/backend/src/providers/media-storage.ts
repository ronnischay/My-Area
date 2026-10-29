import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

/**
 * Where photo bytes live. Services depend on this, never on the filesystem (docs/ARCHITECTURE.md §3).
 * A `key` is a relative path the app generates itself (e.g. `reports/<uuid>.jpg`) and is stored in
 * `report_media.provider_public_id`. Today only local disk (D021); Cloudinary can implement the same interface.
 */
export interface MediaStorage {
  save(key: string, bytes: Buffer): Promise<void>;
  /** null when the file is gone. */
  read(key: string): Promise<Buffer | null>;
  /** No error when the file is already gone. */
  delete(key: string): Promise<void>;
}

/** Files under `rootDir`. Writes go to a temp file first, so a crash never leaves a half-written photo. */
export function createLocalMediaStorage(rootDir: string): MediaStorage {
  const root = resolve(rootDir);
  const pathOf = (key: string) => {
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new Error("media key escapes the upload directory");
    return path;
  };

  return {
    async save(key, bytes) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, bytes, { flag: "wx", mode: 0o640 });
        await rename(temp, path);
      } catch (err) {
        await rm(temp, { force: true });
        throw err;
      }
    },

    async read(key) {
      try {
        return await readFile(pathOf(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async delete(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
