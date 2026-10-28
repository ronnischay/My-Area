import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centred content column: 16px gutters on mobile, max-w-6xl on wide screens. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
