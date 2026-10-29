import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ReportGrid } from "@/components/reports/ReportCard";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { listReports, reportQueryFrom, toSearch } from "@/lib/server/reports";
import { requireMember } from "@/lib/server/session";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <Suspense fallback={<ReportsSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/reports">, "searchParams">) {
  const user = await requireMember();
  const query = reportQueryFrom(await searchParams);
  const { data, meta } = await listReports(query);
  const filtered = Boolean(query.q || query.status || query.category || query.mine);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">{query.mine ? "My reports" : "Reports"}</h1>
          <p className="text-fg-muted">
            {meta.total} {meta.total === 1 ? "report" : "reports"} in {user.society.name}
            {filtered && " match your filters"}
          </p>
        </div>
        <div className="hidden sm:block">
          <ButtonLink href="/reports/new" variant="brand" size="lg">
            Report an issue
          </ButtonLink>
        </div>
      </div>
      {/* Keyed on the filters: the inputs are uncontrolled, so a client-side navigation that changes the
          URL (Clear filters, Back) must rebuild the form or it keeps showing the old choices. */}
      <ReportFilters key={toSearch(query)} q={query.q} status={query.status} category={query.category} mine={query.mine === true} />
      {data.length > 0 ? (
        <>
          <h2 className="sr-only">Results</h2>
          <ReportGrid reports={data} />
          <Pagination meta={meta} label="Report pages" hrefFor={(page) => `/reports${toSearch({ ...query, page })}`} />
        </>
      ) : (
        <EmptyState
          title={filtered ? "No reports match" : "No reports yet"}
          description={filtered ? "Try another status, category or search." : "Nothing has been reported in your society. Spot a problem? Report the first issue."}
          action={<ButtonLink href={filtered ? "/reports" : "/reports/new"} variant={filtered ? "secondary" : "brand"}>{filtered ? "Clear filters" : "Report an issue"}</ButtonLink>}
        />
      )}
    </>
  );
}

function ReportsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading reports…</span>
      <Skeleton className="h-16 w-2/3 max-w-md" />
      <Skeleton className="h-13" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
