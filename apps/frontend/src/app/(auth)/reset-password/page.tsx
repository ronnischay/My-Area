import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";

// no-referrer: the token is in this page's URL and must not leak to other sites.
export const metadata: Metadata = { title: "Reset password", referrer: "no-referrer" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Container className="flex justify-center pt-4 sm:pt-10">
      <div className="w-full max-w-md rounded-panel border border-border bg-surface p-6 sm:p-8">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <Reset searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Reset({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
