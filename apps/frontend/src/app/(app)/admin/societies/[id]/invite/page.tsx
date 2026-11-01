import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Invite someone" };

type Params = Pick<PageProps<"/admin/societies/[id]/invite">, "params">;

/** Phones and tablets: the invite form on its own page (lg+ shows it beside the members). */
export default function InvitePage({ params }: PageProps<"/admin/societies/[id]/invite">) {
  return (
    <Container className="flex max-w-md flex-col gap-6 pt-6">
      <Suspense fallback={<Skeleton className="h-11 w-32" />}>
        <BackLink params={params} />
      </Suspense>
      <h1 className="font-display text-display font-bold text-fg">Invite someone</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Invite params={params} />
      </Suspense>
    </Container>
  );
}

async function BackLink({ params }: Params) {
  const { id } = await params;
  return (
    <Link href={`/admin/societies/${id}`} className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
      ← Members
    </Link>
  );
}

async function Invite({ params }: Params) {
  await requireAdmin();
  return <InviteMemberForm societyId={(await params).id} />;
}
