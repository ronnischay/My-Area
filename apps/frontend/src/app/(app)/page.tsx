import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ReportGrid } from "@/components/reports/ReportCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/reports";
import { listReports, reportQueryFrom } from "@/lib/server/reports";
import { requireMember } from "@/lib/server/session";
import type { ReportCategory } from "@/types/api";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <Suspense fallback={<Skeleton className="h-12 w-48" />}>
        <Greeting />
      </Suspense>
      <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">What&apos;s happening around you</h1>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Greeting() {
  const user = await requireMember();
  return (
    <p className="flex flex-col">
      <span className="text-sm font-semibold text-fg-muted">{user.society.name}</span>
      <span className="text-lg font-semibold text-fg">Hi, {firstName(user.name)}</span>
    </p>
  );
}

async function Feed({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await requireMember();
  const query = reportQueryFrom(await searchParams, 6);
  const { data, meta } = await listReports({ page: 1, pageSize: 6, ...(query.category ? { category: query.category } : {}) });

  return (
    <>
      <CategoryChips selected={query.category} />
      {data.length > 0 ? (
        <section aria-labelledby="latest" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="latest" className="font-display text-xl font-bold text-fg">
              {query.category ? `Latest in ${CATEGORY_LABELS[query.category]}` : "Latest reports"}
            </h2>
            {meta.total > data.length && (
              <Link href={query.category ? `/reports?category=${query.category}` : "/reports"} className="inline-flex min-h-11 items-center font-semibold text-primary">
                See all {meta.total}
              </Link>
            )}
          </div>
          <ReportGrid reports={data} />
        </section>
      ) : (
        <EmptyState
          title={query.category ? `Nothing in ${CATEGORY_LABELS[query.category]}` : "No reports yet"}
          description={query.category ? "No reports in this category yet." : "Spot a problem in your society? Report the first issue."}
          action={
            <ButtonLink href="/reports/new" variant="brand">
              Report an issue
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

/** Horizontal, scrollable category filter. Links, so the choice is in the URL. */
function CategoryChips({ selected }: { selected?: ReportCategory }) {
  const chip = (href: string, label: string, active: boolean) => (
    <li key={href} className="shrink-0">
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
          active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-muted",
        )}
      >
        {label}
      </Link>
    </li>
  );

  return (
    // Scrolls sideways (swipe, trackpad, or Tab to a chip) without drawing a scrollbar under the chips.
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-2">
        {chip("/", "All", !selected)}
        {CATEGORIES.map((c) => chip(`/?category=${c.value}`, c.label, selected === c.value))}
      </ul>
    </nav>
  );
}

function FeedSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading reports…</span>
      <Skeleton className="h-11" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
