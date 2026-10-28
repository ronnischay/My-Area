import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "./Container";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-lg font-bold text-fg">
          <svg viewBox="0 0 24 24" fill="none" className="size-7 text-primary" aria-hidden="true">
            <path
              d="M12 2.5c-3.9 0-7 3-7 6.9 0 5.1 7 12.1 7 12.1s7-7 7-12.1c0-3.9-3.1-6.9-7-6.9Z"
              fill="currentColor"
            />
            <circle cx="12" cy="9.5" r="2.6" fill="white" />
          </svg>
          MyArea
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/reports"
            className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            Reports
          </Link>
          <ButtonLink href="/reports/new" size="sm">
            <span className="sm:hidden">Report issue</span>
            <span className="hidden sm:inline">Report an issue</span>
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}
