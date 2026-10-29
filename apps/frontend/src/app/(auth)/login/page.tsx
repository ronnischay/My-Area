import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BuildingBlocks } from "@/components/auth/BuildingBlocks";
import { LoginForm } from "@/components/auth/LoginForm";
import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeNextPath } from "@/lib/redirect-target";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Container className="flex justify-center pt-4 sm:pt-10">
      <div className="w-full max-w-md overflow-hidden rounded-panel border border-border bg-surface">
        <BuildingBlocks />
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Your society, looked after.</h1>
            <p className="text-fg-muted">Sign in to report an issue or see what&apos;s being fixed.</p>
          </div>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <SignIn searchParams={searchParams} />
          </Suspense>
          <p className="text-sm text-fg-muted">Got an invite email? Open the link in it to set your password.</p>
        </div>
      </div>
    </Container>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : undefined;
  // Already signed in (and the session is valid): skip the form.
  if (await getCurrentUser()) redirect(safeNextPath(target));
  return <LoginForm next={target} />;
}
