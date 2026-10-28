/**
 * True when a Postgres unique violation (23505) on `constraint` is anywhere in the error chain.
 * Drizzle wraps driver errors (DrizzleQueryError.cause), so walk `cause`.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint === constraint) return true;
    current = candidate.cause;
  }
  return false;
}
