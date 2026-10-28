import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-fg-muted",
  info: "border-info-border bg-info-soft text-info",
  warning: "border-warning-border bg-warning-soft text-warning",
  success: "border-success-border bg-success-soft text-success",
  danger: "border-danger-border bg-danger-soft text-danger",
};

/** Always carries a text label — colour is never the only signal (UI_UX_GUIDELINES §2). */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
