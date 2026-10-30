import type { SVGProps } from "react";

/** Outline thumbs-up; `filled` once you've given one. Decorative: the button/label carries the meaning. */
export function ThumbsUpIcon({ filled = false, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.4-7.3a1.6 1.6 0 0 1 2.9 1.2L13.2 9H19a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 17.7 21H7" />
    </svg>
  );
}
