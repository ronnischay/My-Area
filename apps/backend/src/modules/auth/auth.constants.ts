// Auth limits from docs/features/auth.md. Constants, not env: changing them is a product decision.

export const SESSION_COOKIE = "myarea_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Forgot password: a link lasts an hour; at most 3 emails per address per hour.
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_MAX_REQUESTS = 3;
export const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

// Expired sessions are deleted at startup and then this often.
export const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
