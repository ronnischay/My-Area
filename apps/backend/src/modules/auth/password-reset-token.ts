import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Forgot-password links without a table (D030): `<payload>.<signature>`, both base64url. The payload
 * holds the user id, the expiry and a fingerprint of the user's current password hash, and is signed
 * with HMAC-SHA256. Changing the password changes the fingerprint, so a link works once.
 */
export interface ResetTokenPayload {
  userId: string;
  expiresAt: Date;
  /** First 32 hex chars of SHA-256(password_hash). */
  fingerprint: string;
}

export const passwordFingerprint = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("hex").slice(0, 32);

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function createResetToken(payload: ResetTokenPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify({ u: payload.userId, e: payload.expiresAt.getTime(), f: payload.fingerprint })).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

/** The payload if the signature is valid and the link hasn't expired; null otherwise (never throws). */
export function readResetToken(token: string, secret: string, now: Date): ResetTokenPayload | null {
  const [data, signature, ...rest] = token.split(".");
  if (!data || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const { u, e, f } = (parsed ?? {}) as { u?: unknown; e?: unknown; f?: unknown };
  if (typeof u !== "string" || typeof e !== "number" || typeof f !== "string") return null;
  if (e <= now.getTime()) return null;
  return { userId: u, expiresAt: new Date(e), fingerprint: f };
}
