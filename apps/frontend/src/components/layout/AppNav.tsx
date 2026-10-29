"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { UserRole } from "@/types/api";
import { cn } from "@/lib/cn";
import { HomeIcon, InboxIcon, ListIcon, PlusIcon, StarIcon, UserIcon } from "./icons";

interface NavProps {
  role: UserRole;
  /** False only for an admin who hasn't set up the society yet: nothing to navigate to. */
  hasSociety: boolean;
}

function useIsActive() {
  const pathname = usePathname();
  const mine = useSearchParams().get("mine") === "true";
  return (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/reports?mine=true") return pathname === "/reports" && mine;
    if (href === "/reports") return pathname === "/reports" && !mine;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

/** `md`+ : pill nav in the header (UI_UX_GUIDELINES §4). */
export function PillNav({ role, hasSociety }: NavProps) {
  const isActive = useIsActive();
  if (!hasSociety) return null;
  const links = [
    { href: "/", label: "Home" },
    { href: "/reports", label: "Reports" },
    ...(role === "MANAGER" || role === "ADMIN" ? [{ href: "/management", label: "Management" }] : []),
    ...(role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Members" },
          { href: "/admin/society", label: "Society" },
        ]
      : []),
  ];

  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill px-4 font-semibold transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Below `md`: bottom tab bar with the raised Report button. Hidden on full-screen forms. */
export function TabBar({ role, hasSociety }: NavProps) {
  const pathname = usePathname();
  const isActive = useIsActive();
  if (!hasSociety || pathname === "/reports/new") return null;

  const tab = (href: string, label: string, Icon: typeof HomeIcon) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-field text-xs font-semibold",
          active ? "text-primary" : "text-fg-muted",
        )}
      >
        <Icon className="size-6" />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-end gap-1 px-2 pt-1 pb-1">
        {tab("/", "Home", HomeIcon)}
        {tab("/reports", "Reports", ListIcon)}
        <Link
          href="/reports/new"
          className="-mt-6 flex flex-1 flex-col items-center gap-1 text-xs font-semibold text-fg"
        >
          <span className="flex size-15 items-center justify-center rounded-pill bg-brand text-brand-fg shadow-md ring-4 ring-canvas">
            <PlusIcon className="size-7" strokeWidth={2.5} />
          </span>
          Report
        </Link>
        {/* Managers and admins work from the queue; residents follow their own reports. */}
        {role === "MANAGER" || role === "ADMIN" ? tab("/management", "Queue", InboxIcon) : tab("/reports?mine=true", "Mine", StarIcon)}
        {tab("/profile", "Profile", UserIcon)}
      </div>
    </nav>
  );
}
