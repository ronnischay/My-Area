import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Invite a neighbour" };

/** Phones and tablets: the invite form on its own page (lg+ shows it beside the list). */
export default function InviteMemberPage() {
  return (
    <Container className="flex max-w-md flex-col gap-6 pt-6">
      <Link href="/admin/users" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
        ← Members
      </Link>
      <h1 className="font-display text-display font-bold text-fg">Invite a neighbour</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AdminOnly />
      </Suspense>
    </Container>
  );
}

async function AdminOnly() {
  await requireRole("ADMIN");
  return <InviteMemberForm />;
}
