import type { UserRole } from "@/types/api";

export const ROLE_LABELS: Record<UserRole, string> = { ADMIN: "Admin", MANAGER: "Manager", RESIDENT: "Resident" };

/** "31 Oct at 6:40 pm" in the viewer's time zone. Call only in the browser or at request time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return `${day} at ${time}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
