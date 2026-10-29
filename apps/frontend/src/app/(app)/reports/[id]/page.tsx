import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { RelativeTime } from "@/components/reports/RelativeTime";
import { ReportPhoto } from "@/components/reports/ReportPhoto";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { CATEGORY_LABELS } from "@/lib/reports";
import { getReport } from "@/lib/server/reports";
import { requireMember } from "@/lib/server/session";
import type { ReportMedia } from "@/types/api";

export const metadata: Metadata = { title: "Report" };

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <Link href="/reports" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
        ← Reports
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <ReportDetail params={params} />
      </Suspense>
    </Container>
  );
}

async function ReportDetail({ params }: Pick<PageProps<"/reports/[id]">, "params">) {
  await requireMember();
  const { id } = await params;
  const report = await getReport(id);
  // Unknown, malformed and other societies' ids all look the same.
  if (!report) notFound();

  const submission = report.media.filter((m) => m.purpose === "SUBMISSION");
  const resolution = report.media.filter((m) => m.purpose === "RESOLUTION");

  return (
    <article className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="flex flex-col gap-4">
        {submission.length > 0 ? (
          submission.map((photo, index) => <Photo key={photo.id} photo={photo} alt={`Photo of: ${report.title}`} priority={index === 0} />)
        ) : (
          <ReportPhoto src={null} alt="" className="rounded-card" />
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          <Badge tone="brand">{CATEGORY_LABELS[report.category]}</Badge>
          {report.isMine && <Badge tone="neutral">Your report</Badge>}
        </div>
        <h1 className="font-display text-display font-bold break-words text-fg sm:text-display-lg">{report.title}</h1>
        <dl className="grid gap-3 rounded-card border border-border bg-surface p-4">
          <div>
            <dt className="text-sm text-fg-muted">Location</dt>
            <dd className="font-semibold break-words text-fg">{report.locationText}</dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">Submitted</dt>
            <dd className="font-semibold text-fg">
              <RelativeTime iso={report.createdAt} />
              {report.createdBy && ` by ${report.isMine ? "you" : report.createdBy.name}`}
            </dd>
          </div>
          {report.resolvedAt && (
            <div>
              <dt className="text-sm text-fg-muted">Resolved</dt>
              <dd className="font-semibold text-fg">
                <RelativeTime iso={report.resolvedAt} />
              </dd>
            </div>
          )}
        </dl>
        <section aria-labelledby="description" className="flex flex-col gap-2">
          <h2 id="description" className="font-display text-xl font-bold text-fg">
            Description
          </h2>
          <p className="max-w-[70ch] break-words whitespace-pre-line text-fg">{report.description}</p>
        </section>
        {resolution.length > 0 && (
          <section aria-labelledby="resolution" className="flex flex-col gap-3">
            <h2 id="resolution" className="font-display text-xl font-bold text-fg">
              Resolution photos
            </h2>
            {resolution.map((photo) => (
              <Photo key={photo.id} photo={photo} alt={`Resolution photo for: ${report.title}`} />
            ))}
          </section>
        )}
      </div>
    </article>
  );
}

/** The photo at its own shape; opens full size in a new tab. */
function Photo({ photo, alt, priority = false }: { photo: ReportMedia; alt: string; priority?: boolean }) {
  return (
    <a href={photo.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-card border border-border">
      <ReportPhoto src={photo.url} alt={alt} width={photo.width} height={photo.height} frame="natural" priority={priority} />
      <span className="sr-only"> (opens full size in a new tab)</span>
    </a>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" className="grid gap-6 lg:grid-cols-2">
      <span className="sr-only">Loading report…</span>
      <Skeleton className="aspect-[4/3]" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
