"use client";

import { useSyncExternalStore } from "react";
import { readThemePreference, resolvedTheme, THEME_CHANGE_EVENT, type ThemePreference } from "@/lib/theme";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

/** The stored preference and what it resolves to. The server render assumes light (the default). */
export function useThemePreference(): { preference: ThemePreference; theme: "light" | "dark" } {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "light" as const);
  const theme = useSyncExternalStore(
    subscribe,
    () => resolvedTheme(readThemePreference()),
    () => "light" as const,
  );
  return { preference, theme };
}
