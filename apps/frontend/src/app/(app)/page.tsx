import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { firstName } from "@/lib/format";
import { requireMember } from "@/lib/server/session";

export default function HomePage() {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <Suspense fallback={<Skeleton className="h-6 w-48" />}>
        <Greeting />
      </Suspense>
      <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">What&apos;s happening around you</h1>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/reports/new" variant="brand" size="lg">
          Report an issue
        </ButtonLink>
        <ButtonLink href="/reports" variant="secondary" size="lg">
          See all reports
        </ButtonLink>
      </div>
    </Container>
  );
}

async function Greeting() {
  const user = await requireMember();
  return (
    <p className="text-fg-muted">
      <span className="text-sm font-semibold">{user.society.name}</span>
      <br />
      <span className="text-lg font-semibold text-fg">Hi, {firstName(user.name)}</span>
    </p>
  );
}
