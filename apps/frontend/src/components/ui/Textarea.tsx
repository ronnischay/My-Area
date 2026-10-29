import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./Input";

interface TextareaProps extends ComponentProps<"textarea"> {
  /** Shows a character counter once the value reaches 80% of maxLength. */
  showCount?: boolean;
}

export function Textarea({ className, showCount = false, maxLength, value, ...props }: TextareaProps) {
  const length = typeof value === "string" ? value.length : 0;
  const showCounter = showCount && maxLength !== undefined && length >= maxLength * 0.8;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={cn(controlClasses, "min-h-32 py-3", className)}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      {showCounter && (
        <p className="self-end text-sm text-fg-muted" aria-live="polite">
          {length}/{maxLength} characters
        </p>
      )}
    </div>
  );
}
