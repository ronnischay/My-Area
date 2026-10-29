"use client";

import { useThemePreference } from "@/components/theme/useThemePreference";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { setThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match device" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** Profile → Appearance (D019). */
export function AppearanceSetting() {
  const { preference } = useThemePreference();
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl label="Theme" name="theme" options={OPTIONS} value={preference} onChange={setThemePreference} />
      <p className="text-sm text-fg-muted">Light is the default. Saved on this device.</p>
    </div>
  );
}
