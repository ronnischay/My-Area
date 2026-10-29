import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Join your society", referrer: "no-referrer" };

export default function InvitePage({ searchParams }: PageProps<"/invite">) {
  return (
    <Container className="flex justify-center pt-4 sm:pt-10">
      <div className="w-full max-w-md rounded-panel border border-border bg-surface p-6 sm:p-8">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Invite searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Invite({ searchParams }: Pick<PageProps<"/invite">, "searchParams">) {
  const { token } = await searchParams;
  return <AcceptInviteForm token={typeof token === "string" ? token : ""} />;
}
