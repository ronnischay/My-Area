import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteMemberForm } from "@/components/admin/InviteMemberForm";
import { MemberFilters } from "@/components/admin/MemberFilters";
import { MembersList } from "@/components/admin/MembersList";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Pagination, queryString } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { backendGet } from "@/lib/server/backend";
import { requireRole } from "@/lib/server/session";
import type { ListResponse, SocietyMember } from "@/types/api";

export const metadata: Metadata = { title: "Members" };

type Search = Awaited<PageProps<"/admin/users">["searchParams"]>;
const one = (value: Search[string]) => (typeof value === "string" && value ? value : undefined);

export default function MembersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Container className="grid gap-8 pt-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-16 w-2/3" />}>
          <MembersHeading />
        </Suspense>
        <ButtonLink href="/admin/users/new" variant="brand" size="lg" className="lg:hidden">
          Invite a neighbour
        </ButtonLink>
        <Suspense fallback={<MembersSkeleton />}>
          <Members searchParams={searchParams} />
        </Suspense>
      </div>
      <aside aria-labelledby="invite-heading" className="hidden flex-col gap-4 rounded-panel border border-border bg-surface p-5 lg:sticky lg:top-24 lg:flex">
        <h2 id="invite-heading" className="font-display text-xl font-bold text-fg">
          Invite a neighbour
        </h2>
        <InviteMemberForm />
      </aside>
    </Container>
  );
}

async function MembersHeading() {
  const user = await requireRole("ADMIN");
  const [all, invited] = await Promise.all([
    backendGet<ListResponse<SocietyMember>>("/api/admin/users?pageSize=1"),
    backendGet<ListResponse<SocietyMember>>("/api/admin/users?pageSize=1&status=INVITED"),
  ]);
  const neighbours = `${all.meta.total} ${all.meta.total === 1 ? "neighbour" : "neighbours"}`;
  const pending = invited.meta.total > 0 ? ` · ${invited.meta.total} haven't joined yet` : "";
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Members of {user.society.name}</h1>
      <p className="text-fg-muted">
        {neighbours}
        {pending}
      </p>
    </div>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = { q: one(params.q), role: one(params.role), status: one(params.status) };
  const page = Math.max(1, Number(one(params.page)) || 1);
  const { data, meta } = await backendGet<ListResponse<SocietyMember>>(`/api/admin/users${queryString({ ...filters, page })}`);
  const filtered = Boolean(filters.q || filters.role || filters.status);

  return (
    <>
      {/* Keyed so client-side navigation (Back) rebuilds the uncontrolled inputs from the URL. */}
      <MemberFilters key={queryString(filters)} {...filters} />
      <MembersList members={data} currentUserId={user.id} filtered={filtered} />
      <Pagination meta={meta} label="Member pages" hrefFor={(p) => `/admin/users${queryString({ ...filters, page: p })}`} />
    </>
  );
}

function MembersSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Loading members…</span>
      <Skeleton className="h-14" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}
