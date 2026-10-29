import { STATUS_META } from "@/lib/reports";
import type { StatusHistoryEntry } from "@/types/api";
import { RelativeTime } from "./RelativeTime";

/** Dot + label + time · person, then the note (UI_UX_GUIDELINES §8). Oldest first, like a story. */
export function StatusTimeline({ createdAt, entries }: { createdAt: string; entries: StatusHistoryEntry[] }) {
  return (
    <ol className="flex flex-col">
      <TimelineItem title="Reported" iso={createdAt} last={entries.length === 0} />
      {entries.map((entry, index) => (
        <TimelineItem
          key={entry.id}
          title={`${STATUS_META[entry.fromStatus].label} → ${STATUS_META[entry.toStatus].label}`}
          iso={entry.createdAt}
          by={entry.changedBy.name}
          note={entry.note}
          last={index === entries.length - 1}
        />
      ))}
    </ol>
  );
}

function TimelineItem({ title, iso, by, note, last }: { title: string; iso: string; by?: string; note?: string | null; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute top-4 left-[7px] h-full w-0.5 bg-border" />}
      <span aria-hidden="true" className="relative mt-1.5 size-4 shrink-0 rounded-pill border-4 border-primary-soft bg-primary" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-fg">{title}</p>
        <p className="text-sm text-fg-muted">
          <RelativeTime iso={iso} />
          {by && ` · ${by}`}
        </p>
        {note && <p className="rounded-field bg-surface-muted px-3 py-2 break-words whitespace-pre-line text-fg">{note}</p>}
      </div>
    </li>
  );
}
