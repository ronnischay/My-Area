"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, MINUTE);
  return () => clearInterval(timer);
};
const currentMinute = () => Math.floor(Date.now() / MINUTE);

// The server and the first client render show the date in UTC (identical on both, so no hydration
// mismatch); after hydration it switches to "3 hours ago" in the viewer's clock.
const utcDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, nowMs: number): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - nowMs) / MINUTE);
  const abs = Math.abs(diffMinutes);
  if (abs < 1) return "just now";
  if (abs < 60) return relative.format(diffMinutes, "minute");
  if (abs < 60 * 24) return relative.format(Math.round(diffMinutes / 60), "hour");
  if (abs < 60 * 24 * 30) return relative.format(Math.round(diffMinutes / (60 * 24)), "day");
  return utcDate.format(new Date(iso));
}

/** "3 hours ago", with the exact date and time in a tooltip and in <time dateTime>. */
export function RelativeTime({ iso, prefix }: { iso: string; prefix?: string }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  const text = minute === null ? utcDate.format(new Date(iso)) : relativeTime(iso, minute * MINUTE);
  return (
    <time dateTime={iso} title={minute === null ? undefined : fullDate.format(new Date(iso))}>
      {prefix}
      {text}
    </time>
  );
}
