import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Pagination as PaginationMeta } from "@/types/api";

interface PaginationProps {
  meta: PaginationMeta;
  /** Builds the link for a page, keeping the current filters. */
  hrefFor: (page: number) => string;
  label?: string;
}

/** Previous / next links with "Page 2 of 5". Plain links, so it works without JavaScript. */
export function Pagination({ meta, hrefFor, label = "Pages" }: PaginationProps) {
  if (meta.totalPages <= 1) return null;
  const prev = meta.page > 1 ? meta.page - 1 : null;
  const next = meta.page < meta.totalPages ? meta.page + 1 : null;
  const link = "inline-flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-5 font-semibold text-fg hover:bg-surface-muted";
  const disabled = "inline-flex min-h-11 items-center rounded-pill border border-border px-5 font-semibold text-fg-muted opacity-60";

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      {prev ? (
        <Link href={hrefFor(prev)} className={link} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          Previous
        </span>
      )}
      <p className="text-sm text-fg-muted">
        Page {meta.page} of {meta.totalPages}
      </p>
      {next ? (
        <Link href={hrefFor(next)} className={cn(link)} rel="next">
          Next
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}

/** `?a=1&b=2` from an object, skipping empty values. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
