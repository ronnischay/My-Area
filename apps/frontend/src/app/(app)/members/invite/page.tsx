import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Invite a resident" };

/** Phones and tablets: the manager's invite form on its own page (lg+ shows it beside the list). */
export default function InviteResidentPage() {
  return (
    <Container className="flex max-w-md flex-col gap-6 pt-6">
      <Link href="/members" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
        ← Members
      </Link>
      <h1 className="font-display text-display font-bold text-fg">Invite a resident</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Invite />
      </Suspense>
    </Container>
  );
}

async function Invite() {
  const user = await requireRole("MANAGER");
  return <InviteMemberForm societyId={user.society.id} residentsOnly />;
}
