import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Use "h1" when the empty state is the whole page (one h1 per page). */
  headingLevel?: "h1" | "h2";
}

export function EmptyState({ title, description, icon, action, className, headingLevel: Heading = "h2" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-fg-muted" aria-hidden="true">{icon}</div>}
      <Heading className="font-display text-xl font-bold text-fg">{title}</Heading>
      {description && <p className="max-w-md text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
