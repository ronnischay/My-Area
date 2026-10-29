import { Badge } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/reports";
import type { ReportStatus } from "@/types/api";

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
