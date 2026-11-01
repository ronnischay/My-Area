import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { MembersSection, MembersSkeletonRows, MembersSummary } from "@/components/admin/MembersSection";
import { SocietyForm } from "@/components/admin/SocietyForm";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { backendGet } from "@/lib/server/backend";
import { requireAdmin } from "@/lib/server/session";
import type { DataResponse, Society } from "@/types/api";

export const metadata: Metadata = { title: "Society" };

type Params = Pick<PageProps<"/admin/societies/[id]">, "params">;

/** The society in the URL, for an admin; 404 for an unknown or malformed id, like the API. */
async function loadSociety({ params }: Params): Promise<Society> {
  await requireAdmin();
  const { id } = await params;
  try {
    return (await backendGet<DataResponse<Society>>(`/api/societies/${id}`)).data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/** One society for the admin: its members (invite, manage) and its details. */
export default function SocietyPage({ params, searchParams }: PageProps<"/admin/societies/[id]">) {
  return (
    <Container className="grid gap-8 pt-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Link href="/admin/societies" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
          ← Societies
        </Link>
        <Suspense fallback={<Skeleton className="h-16 w-2/3" />}>
          <Heading params={params} />
        </Suspense>
        <Suspense fallback={<MembersSkeletonRows />}>
          <Members params={params} searchParams={searchParams} />
        </Suspense>
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-24">
        <section aria-labelledby="invite-heading" className="hidden flex-col gap-4 rounded-panel border border-border bg-surface p-5 lg:flex">
          <h2 id="invite-heading" className="font-display text-xl font-bold text-fg">
            Invite someone
          </h2>
          <Suspense fallback={<Skeleton className="h-80" />}>
            <Invite params={params} />
          </Suspense>
        </section>
        <section aria-labelledby="details-heading" className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5">
          <h2 id="details-heading" className="font-display text-xl font-bold text-fg">
            Society details
          </h2>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Details params={params} />
          </Suspense>
        </section>
      </div>
    </Container>
  );
}

async function Heading({ params }: Params) {
  const society = await loadSociety({ params });
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">{society.name}</h1>
        <MembersSummary societyId={society.id} />
      </div>
      <ButtonLink href={`/admin/societies/${society.id}/invite`} variant="brand" size="lg" className="lg:hidden">
        Invite someone
      </ButtonLink>
    </>
  );
}

async function Members({ params, searchParams }: Pick<PageProps<"/admin/societies/[id]">, "params" | "searchParams">) {
  const [society, viewer] = await Promise.all([loadSociety({ params }), requireAdmin()]);
  return <MembersSection societyId={society.id} viewer={viewer} searchParams={searchParams} basePath={`/admin/societies/${society.id}`} />;
}

async function Invite({ params }: Params) {
  const society = await loadSociety({ params });
  return <InviteMemberForm societyId={society.id} />;
}

async function Details({ params }: Params) {
  return <SocietyForm society={await loadSociety({ params })} />;
}
