import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_LABELS } from "@/lib/reports";
import type { ReportSummary } from "@/types/api";
import { RelativeTime } from "./RelativeTime";
import { ReportPhoto } from "./ReportPhoto";
import { StatusBadge } from "./StatusBadge";

/** Photo card (UI_UX_GUIDELINES §8): photo with the status badge over it, title, category, location · time. */
export function ReportCard({ report }: { report: ReportSummary }) {
  return (
    // The title link covers the card; its focus ring is drawn on the card itself.
    <article className="relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-border-strong has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <div className="relative">
        <ReportPhoto src={report.thumbnailUrl} alt="" />
        <StatusBadge status={report.status} className="absolute top-3 left-3 shadow-sm" />
        {report.isMine && (
          <Badge tone="brand" className="absolute top-3 right-3 shadow-sm">
            Yours
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-bold text-fg">
          <Link href={`/reports/${report.id}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
            {report.title}
          </Link>
        </h3>
        <p className="text-sm font-semibold text-primary">{CATEGORY_LABELS[report.category]}</p>
        <p className="mt-auto line-clamp-1 text-sm text-fg-muted">
          {report.locationText} · <RelativeTime iso={report.createdAt} />
        </p>
      </div>
    </article>
  );
}

export function ReportGrid({ reports }: { reports: ReportSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <li key={report.id} className="flex">
          <div className="flex w-full flex-col [&>article]:flex-1">
            <ReportCard report={report} />
          </div>
        </li>
      ))}
    </ul>
  );
}
