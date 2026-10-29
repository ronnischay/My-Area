/**
 * Server-only: where the Express API listens. Used by the `/api` rewrite (next.config.ts) and by
 * Server Components (lib/server/backend.ts). Never exposed to the browser (D015); the browser
 * always calls same-origin `/api/...`.
 */
export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
}
