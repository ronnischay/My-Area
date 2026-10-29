import Link from "next/link";

/** Logo + wordmark, linking home. The pin uses the owner's green. */
export function BrandMark() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-pill font-display text-xl font-bold text-fg">
      <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
        <path d="M12 2.5c-3.9 0-7 3-7 6.9 0 5.1 7 12.1 7 12.1s7-7 7-12.1c0-3.9-3.1-6.9-7-6.9Z" fill="var(--color-brand)" />
        <path d="M8.6 10.6 12 8l3.4 2.6V14H8.6v-3.4Z" fill="var(--color-brand-fg)" />
      </svg>
      MyArea
    </Link>
  );
}
