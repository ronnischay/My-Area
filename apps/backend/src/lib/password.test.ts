import { describe, expect, it } from "vitest";
import { createPasswordHasher } from "./password.js";

// Low cost keeps the suite fast; the format and code path are the same as production.
const hasher = createPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });

describe("password hasher", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hasher.hash("correct horse battery");

    expect(await hasher.verify("correct horse battery", stored)).toBe(true);
    expect(await hasher.verify("correct horse batterY", stored)).toBe(false);
  });

  it("stores the scrypt parameters and a fresh salt in every hash", async () => {
    const first = await hasher.hash("same password");
    const second = await hasher.hash("same password");

    expect(first).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("same password");
  });

  it("verifies with the parameters stored in the hash, so the cost can change later", async () => {
    const stored = await hasher.hash("long-lived password");
    const strongerHasher = createPasswordHasher({ N: 2 ** 11, r: 8, p: 1 });

    expect(await strongerHasher.verify("long-lived password", stored)).toBe(true);
  });

  it("returns false instead of throwing for malformed or tampered hashes", async () => {
    const stored = await hasher.hash("password one");
    const tampered = stored.replace(/.$/, (c) => (c === "A" ? "B" : "A"));

    expect(await hasher.verify("password one", tampered)).toBe(false);
    expect(await hasher.verify("password one", "not-a-hash")).toBe(false);
    expect(await hasher.verify("password one", "scrypt$0$8$1$abc$def")).toBe(false);
  });
});
