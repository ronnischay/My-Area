import { createHash, randomBytes } from "node:crypto";

/** A 256-bit random token, base64url (43 chars). Sent to the user; never stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hex SHA-256 of a token (64 chars). This is what the database stores and looks up. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
