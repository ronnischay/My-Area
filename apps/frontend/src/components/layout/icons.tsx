import type { SVGProps } from "react";

/** Small stroke icons for navigation. Decorative: the link text names the destination. */
function Icon({ d, ...props }: SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={d} />
    </svg>
  );
}

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" {...p} />;
export const ListIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />;
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="M12 5v14M5 12h14" {...p} />;
export const UserIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" {...p} />;
export const StarIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z" {...p} />;
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => <Icon d="M16 21a6 6 0 0 0-12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12 10a6 6 0 0 0-4-5.7M16 3.1a4 4 0 0 1 0 7.8" {...p} />;
