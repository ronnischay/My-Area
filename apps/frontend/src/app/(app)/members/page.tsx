import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { MembersSection, MembersSkeletonRows, MembersSummary } from "@/components/admin/MembersSection";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Members" };

/** A manager's view of their own society's members: invite residents, resend their invites (D027). */
export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <Container className="grid gap-8 pt-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-16 w-2/3" />}>
          <Heading />
        </Suspense>
        <ButtonLink href="/members/invite" variant="brand" size="lg" className="lg:hidden">
          Invite a resident
        </ButtonLink>
        <Suspense fallback={<MembersSkeletonRows />}>
          <Members searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-labelledby="invite-heading" className="hidden flex-col gap-4 rounded-panel border border-border bg-surface p-5 lg:sticky lg:top-24 lg:flex">
        <h2 id="invite-heading" className="font-display text-xl font-bold text-fg">
          Invite a resident
        </h2>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <Invite />
        </Suspense>
      </aside>
    </Container>
  );
}

async function Heading() {
  const user = await requireRole("MANAGER");
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Members of {user.society.name}</h1>
      <MembersSummary societyId={user.society.id} />
    </div>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  const user = await requireRole("MANAGER");
  return <MembersSection societyId={user.society.id} viewer={user} searchParams={searchParams} basePath="/members" />;
}

async function Invite() {
  const user = await requireRole("MANAGER");
  return <InviteMemberForm societyId={user.society.id} residentsOnly />;
}
