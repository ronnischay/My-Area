import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { backendGet } from "@/lib/server/backend";
import { requireAdmin } from "@/lib/server/session";
import type { DataResponse, SocietySummary } from "@/types/api";

export const metadata: Metadata = { title: "Societies" };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The admin's home: every society on MyArea. Admins run them from outside (D028). */
export default function SocietiesPage() {
  return (
    <Container className="flex flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Societies</h1>
          <p className="text-fg-muted">Create a society, then invite its managers and residents.</p>
        </div>
        <ButtonLink href="/admin/societies/new" variant="brand" size="lg">
          New society
        </ButtonLink>
      </div>
      <Suspense fallback={<SocietiesSkeleton />}>
        <Societies />
      </Suspense>
    </Container>
  );
}

async function Societies() {
  await requireAdmin();
  const { data } = await backendGet<DataResponse<SocietySummary[]>>("/api/societies");
  if (data.length === 0) {
    return <EmptyState title="No societies yet" description="Create the first one to start inviting people." />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((society) => (
        <li key={society.id}>
          <Link
            href={`/admin/societies/${society.id}`}
            className="flex h-full flex-col gap-1 rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong"
          >
            <span className="font-display text-xl font-bold text-fg">{society.name}</span>
            <span className="text-fg-muted">{society.addressText}</span>
            <span className="mt-2 text-sm font-semibold text-fg-muted">
              {count(society.managerCount, "manager", "managers")} · {count(society.residentCount, "resident", "residents")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SocietiesSkeleton() {
  return (
    <div role="status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Loading societies…</span>
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}
