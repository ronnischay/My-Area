import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with node:crypto scrypt (docs/DECISIONS.md D016).
 * Stored format: `scrypt$N$r$p$<salt base64url>$<key base64url>`, so the cost can be raised later
 * without breaking existing hashes (verify always uses the parameters stored in the hash).
 */

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** OWASP minimum for scrypt. Uses ~128 MB per hash. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /** Returns false (never throws) for a wrong password or a malformed stored hash. */
  verify(plain: string, stored: string): Promise<boolean>;
}

function derive(plain: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; give it headroom over Node's 32 MB default.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) => {
    scrypt(plain.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !key) return null;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every((v) => Number.isInteger(v) && v > 0)) return null;
  return { params, salt: Buffer.from(salt, "base64url"), key: Buffer.from(key, "base64url") };
}

export function createPasswordHasher(params: ScryptParams = DEFAULT_SCRYPT_PARAMS): PasswordHasher {
  return {
    async hash(plain) {
      const salt = randomBytes(SALT_LENGTH);
      const key = await derive(plain, salt, params);
      return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
    },

    async verify(plain, stored) {
      const parsed = parse(stored);
      if (!parsed || parsed.key.length !== KEY_LENGTH) return false;
      const key = await derive(plain, parsed.salt, parsed.params);
      return timingSafeEqual(key, parsed.key);
    },
  };
}
