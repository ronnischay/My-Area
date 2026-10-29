import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

const tones: Record<AlertTone, string> = {
  info: "border-info-border bg-info-soft text-info",
  success: "border-success-border bg-success-soft text-success",
  warning: "border-warning-border bg-warning-soft text-warning",
  error: "border-danger-border bg-danger-soft text-danger",
};

const icons: Record<AlertTone, string> = {
  info: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z",
  success:
    "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z",
  warning:
    "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  error:
    "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
};

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** Extra content under the message, e.g. a retry button. */
  action?: ReactNode;
  className?: string;
}

/** Errors use role="alert" (interrupts); everything else role="status" (polite). */
export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-card border p-4", tones[tone], className)}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0" aria-hidden="true">
        <path fillRule="evenodd" d={icons[tone]} clipRule="evenodd" />
      </svg>
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm text-fg">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
