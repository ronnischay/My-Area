import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Shared control styling: 16px text (prevents iOS zoom), 52px height, error state via aria-invalid.
export const controlClasses =
  "w-full rounded-field border border-border-strong bg-surface px-4 text-base text-fg " +
  "placeholder:text-fg-muted/70 disabled:cursor-not-allowed disabled:bg-surface-muted " +
  "aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, "min-h-13", className)} {...props} />;
}
