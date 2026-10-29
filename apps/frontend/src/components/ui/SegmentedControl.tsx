"use client";

import { type KeyboardEvent, useRef } from "react";
import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. "Theme". */
  label: string;
  /** Visually hide the label when a visible heading already names the group. */
  hideLabel?: boolean;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
}

/**
 * Pill track with 2–3 options; a radio group (UI_UX_GUIDELINES §5). Only the selected option is in the
 * tab order; arrow keys move and select, like native radios.
 */
export function SegmentedControl<T extends string>({ label, hideLabel, options, value, onChange, name }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={`${name ?? label}-label`} className={cn("text-sm font-semibold text-fg", hideLabel && "sr-only")}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${name ?? label}-label`}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-pill bg-surface-muted p-1"
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "min-h-11 rounded-pill px-3 text-sm font-semibold transition-colors",
                selected ? "bg-surface text-fg shadow-md" : "text-fg-muted hover:text-fg",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
