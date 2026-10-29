/** Theme preference (D019): stored per device, applied as `data-theme` on <html>. Light is the default. */

export const THEME_STORAGE_KEY = "myarea-theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** The stored choice, or `light` when there is none or storage is unavailable (private mode, blocked). */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

/** Applies and remembers the choice. The page still switches if storage fails. */
export function setThemePreference(preference: ThemePreference): void {
  document.documentElement.dataset.theme = preference;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not remembered on this device; the current page still uses it.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export const THEME_CHANGE_EVENT = "myarea-theme-change";

/** What the user sees right now: `system` resolved through the OS setting. */
export function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Runs before first paint (inline in <head>), so the page never flashes the wrong theme.
 * Kept tiny and dependency-free; mirrors readThemePreference.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.dataset.theme=t==="dark"||t==="system"?t:"light"}catch(e){document.documentElement.dataset.theme="light"}})();`;
