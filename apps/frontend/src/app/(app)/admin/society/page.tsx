import type { Metadata } from "next";
import { Suspense } from "react";
import { SocietyForm } from "@/components/admin/SocietyForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Society" };

export default function SocietyPage() {
  return (
    <Container className="flex justify-center pt-6 sm:pt-12">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Your society</h1>
          <p className="text-fg-muted">Members see this name when they join and in every email.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <EditSociety />
        </Suspense>
      </div>
    </Container>
  );
}

async function EditSociety() {
  const user = await requireRole("ADMIN");
  return <SocietyForm society={user.society} />;
}
