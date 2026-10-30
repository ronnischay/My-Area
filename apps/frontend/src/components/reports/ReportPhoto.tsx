"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface ReportPhotoProps {
  /** Same-origin `/api/media/:id`; needs the session cookie, so it can't go through next/image. */
  src: string | null;
  alt: string;
  /** Card thumbnails use a fixed frame; the detail page keeps the photo's own shape. */
  frame?: "card" | "natural";
  priority?: boolean;
  className?: string;
}

/**
 * A report photo, or a placeholder when there is none or it fails to load (UI_UX_GUIDELINES §7
 * "Partial"). No pixel size is stored, so the detail view can grow a little as the photo loads.
 */
export function ReportPhoto({ src, alt, frame = "card", priority = false, className }: ReportPhotoProps) {
  const [failed, setFailed] = useState(false);
  const box = frame === "card" ? "aspect-[4/3]" : "";

  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-muted text-fg-muted", box || "aspect-[4/3]", className)} role="img" aria-label={src ? "Photo couldn't load" : "No photo"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="m21 16-5-5-8 8" />
        </svg>
      </div>
    );
  }

  return (
    // Plain <img>: next/image would fetch the photo server-side without the user's cookie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("w-full bg-surface-muted", frame === "card" ? `${box} object-cover` : "h-auto", className)}
    />
  );
}
