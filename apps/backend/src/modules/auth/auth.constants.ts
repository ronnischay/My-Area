// Auth limits from docs/features/auth.md. Constants, not env: changing them is a product decision.

export const SESSION_COOKIE = "myarea_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
