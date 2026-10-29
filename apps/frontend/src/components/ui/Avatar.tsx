import { cn } from "@/lib/cn";

/** First letters of the first and last name: "Meera Iyer" → "MI". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const sizes = { sm: "size-9 text-sm", md: "size-11 text-base", lg: "size-16 text-xl" };

/** Initials on primary-soft. Decorative by default: the name is shown next to it. */
export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill bg-primary-soft font-bold text-primary select-none",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
