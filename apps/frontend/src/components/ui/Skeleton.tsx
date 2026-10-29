import { cn } from "@/lib/cn";

/** Decorative placeholder; pair with a single role="status" label at the region level. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-card bg-surface-muted", className)} />;
}
