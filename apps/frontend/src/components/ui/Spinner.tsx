import { cn } from "@/lib/cn";

interface SpinnerProps {
  /** Accessible label announced to screen readers. Pass `null` when a parent already announces the state. */
  label?: string | null;
  className?: string;
}

export function Spinner({ label = "Loading", className }: SpinnerProps) {
  const icon = (
    <svg
      className={cn("size-5 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );

  if (label === null) return icon;

  return (
    <span role="status" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
