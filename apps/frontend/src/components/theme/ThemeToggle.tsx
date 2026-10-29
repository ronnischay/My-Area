"use client";

import { setThemePreference } from "@/lib/theme";
import { useThemePreference } from "./useThemePreference";

/** Header toggle (D019): switches Light ⇄ Dark. Profile → Appearance also offers "Match device". */
export function ThemeToggle() {
  const { theme } = useThemePreference();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setThemePreference(dark ? "light" : "dark")}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill border border-border bg-surface text-fg transition-colors hover:bg-surface-muted"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
          <path strokeLinejoin="round" d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </button>
  );
}
