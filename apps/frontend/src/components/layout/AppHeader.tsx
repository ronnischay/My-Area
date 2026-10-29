import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import type { CurrentUser } from "@/types/api";
import { BrandMark } from "./BrandMark";
import { PillNav } from "./AppNav";
import { Container } from "./Container";

/** Top bar for signed-in pages: brand, society, nav (md+), theme toggle, report button (md+), avatar → profile. */
export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <Container className="flex min-h-16 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandMark />
          {user.society && (
            <span className="hidden truncate border-l border-border pl-3 text-sm font-semibold text-fg-muted lg:inline">
              {user.society.name}
            </span>
          )}
        </div>
        <PillNav role={user.role} hasSociety={user.society !== null} />
        <div className="flex flex-1 items-center justify-end gap-2">
          {user.society && (
            // Wrapper does the hiding: the button's own inline-flex would override `hidden`.
            <div className="hidden md:block">
              <ButtonLink href="/reports/new" variant="brand" size="sm">
                Report an issue
              </ButtonLink>
            </div>
          )}
          <ThemeToggle />
          <Link href="/profile" className="rounded-pill" aria-label={`Your profile (${user.name})`}>
            <Avatar name={user.name} />
          </Link>
        </div>
      </Container>
    </header>
  );
}

/** Same height as the header, shown while the session loads, so nothing jumps. */
export function AppHeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/95 pt-[env(safe-area-inset-top)]">
      <Container className="flex min-h-16 items-center justify-between gap-3">
        <BrandMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="size-11 rounded-pill bg-surface-muted" aria-hidden="true" />
        </div>
      </Container>
    </header>
  );
}
