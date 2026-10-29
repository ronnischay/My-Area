import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  // The owner's exact green as a fill; dark text keeps it readable (5.6:1).
  brand: "bg-brand text-brand-fg hover:brightness-95",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-muted",
  ghost: "text-fg hover:bg-surface-muted",
  danger: "bg-danger text-surface hover:bg-danger-hover",
};

// Every size keeps a ≥ 44px touch target; primary actions use lg (52px) (UI_UX_GUIDELINES §4–5).
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-13 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Label shown while loading, e.g. "Submitting…". Defaults to the children. */
  loadingText?: string;
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  loadingText,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner label={null} className="size-4" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** A link styled as a button — use for navigation, `Button` for actions. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props} />;
}
