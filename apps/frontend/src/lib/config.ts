// NEXT_PUBLIC_ values are inlined at build time, so they must be referenced literally (not via a variable key).
// Public URL only — never put secrets in NEXT_PUBLIC_ variables.
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
