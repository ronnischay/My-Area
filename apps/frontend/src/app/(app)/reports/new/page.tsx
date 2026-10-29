import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ReportForm } from "@/components/reports/ReportForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireMember } from "@/lib/server/session";

export const metadata: Metadata = { title: "Report an issue" };

export default function NewReportPage() {
  return (
    <Container className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,36rem)_1fr] lg:items-start">
      <div className="flex flex-col gap-6">
        <Link href="/" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
          ← Back
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Report an issue</h1>
          <p className="text-fg-muted">All fields are required.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-[36rem]" />}>
          <MembersOnly />
        </Suspense>
      </div>
      <aside aria-labelledby="next-steps" className="hidden flex-col gap-3 rounded-panel border border-border bg-surface p-6 lg:mt-36 lg:flex">
        <h2 id="next-steps" className="font-display text-xl font-bold text-fg">
          What happens next
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-fg-muted">
          <li>Your report and photo are saved for your society.</li>
          <li>Your society&apos;s managers get an email about it.</li>
          <li>You can follow its status under Mine.</li>
        </ol>
      </aside>
    </Container>
  );
}

async function MembersOnly() {
  await requireMember();
  return <ReportForm />;
}
