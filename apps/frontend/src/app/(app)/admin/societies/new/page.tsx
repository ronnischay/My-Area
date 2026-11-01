import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SocietyForm } from "@/components/admin/SocietyForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "New society" };

export default function NewSocietyPage() {
  return (
    <Container className="flex max-w-md flex-col gap-6 pt-6">
      <Link href="/admin/societies" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
        ← Societies
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display font-bold text-fg">New society</h1>
        <p className="text-fg-muted">Members see this name when they join and in every email.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <CreateSociety />
      </Suspense>
    </Container>
  );
}

async function CreateSociety() {
  await requireAdmin();
  return <SocietyForm />;
}
