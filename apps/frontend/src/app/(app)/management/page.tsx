import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ReportGrid } from "@/components/reports/ReportCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { STATUSES, isStatus } from "@/lib/reports";
import { backendGet } from "@/lib/server/backend";
import { listReports, toSearch } from "@/lib/server/reports";
import { requireRole } from "@/lib/server/session";
import type { DataResponse, ManagementStats, ReportStatus } from "@/types/api";

export const metadata: Metadata = { title: "Management" };

export default function ManagementPage({ searchParams }: PageProps<"/management">) {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/management">, "searchParams">) {
  const user = await requireRole("MANAGER");
  const params = await searchParams;
  const status = isStatus(params.status) ? params.status : undefined;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const { data: stats } = await backendGet<DataResponse<ManagementStats>>("/api/management/stats");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Management</h1>
        <p className="text-fg-muted">Reports in {user.society.name}. Open one to update its status.</p>
      </div>
      {/* Counts double as filters (UI_UX_GUIDELINES §8). */}
      <nav aria-label="Filter by status">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUSES.map((s) => {
            const active = status === s.value;
            return (
              <li key={s.value}>
                <Link
                  href={active ? "/management" : `/management?status=${s.value}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex min-h-20 flex-col justify-center rounded-card border px-4 py-3 transition-colors",
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >
                  <span className="font-display text-display font-bold text-fg tabular-nums">{stats.byStatus[s.value]}</span>
                  <span className="text-sm font-semibold text-fg-muted">{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {status ? (
        <StatusList status={status} page={page} />
      ) : (
        <>
          {/* Default: what still needs action. */}
          <Queue status="OPEN" title="Waiting for action" />
          <Queue status="IN_PROGRESS" title="In progress" />
        </>
      )}
    </>
  );
}

async function Queue({ status, title }: { status: ReportStatus; title: string }) {
  const { data, meta } = await listReports({ status, page: 1, pageSize: 6, sort: "oldest" });
  return (
    <section aria-labelledby={`queue-${status}`} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`queue-${status}`} className="font-display text-xl font-bold text-fg">
          {title} <span className="text-fg-muted tabular-nums">({meta.total})</span>
        </h2>
        {meta.total > data.length && (
          <Link href={`/management?status=${status}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
            See all
          </Link>
        )}
      </div>
      {data.length > 0 ? <ReportGrid reports={data} /> : <p className="text-fg-muted">Nothing here right now.</p>}
    </section>
  );
}

async function StatusList({ status, page }: { status: ReportStatus; page: number }) {
  const query = { status, page, pageSize: 12, sort: "oldest" as const };
  const { data, meta } = await listReports(query);
  if (data.length === 0) return <EmptyState title="No reports with this status" description="Choose another status above." />;
  return (
    <>
      <h2 className="sr-only">Reports</h2>
      <ReportGrid reports={data} />
      <Pagination meta={meta} label="Report pages" hrefFor={(p) => `/management${toSearch({ status, page: p })}`} />
    </>
  );
}
