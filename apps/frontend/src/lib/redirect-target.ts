/** Only same-site paths: "/reports?mine=true" yes; "//evil.example" or "https://…" no (open redirect). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
