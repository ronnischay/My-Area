import { MemberFilters } from "@/components/admin/MemberFilters";
import { MembersList } from "@/components/admin/MembersList";
import { Pagination, queryString } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { backendGet } from "@/lib/server/backend";
import type { CurrentUser, ListResponse, SocietyMember } from "@/types/api";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: SearchParams[string]) => (typeof value === "string" && value ? value : undefined);

/** "12 people · 3 haven't joined yet" for a society (two count-only requests). */
export async function MembersSummary({ societyId }: { societyId: string }) {
  const [all, invited] = await Promise.all([
    backendGet<ListResponse<SocietyMember>>(`/api/societies/${societyId}/members?pageSize=1`),
    backendGet<ListResponse<SocietyMember>>(`/api/societies/${societyId}/members?pageSize=1&status=INVITED`),
  ]);
  const people = `${all.meta.total} ${all.meta.total === 1 ? "person" : "people"}`;
  const pending = invited.meta.total > 0 ? ` · ${invited.meta.total} haven't joined yet` : "";
  return (
    <p className="text-fg-muted">
      {people}
      {pending}
    </p>
  );
}

/** Filters, member rows and pages for one society; `basePath` is the page these live on. */
export async function MembersSection({
  societyId,
  viewer,
  searchParams,
  basePath,
}: {
  societyId: string;
  viewer: CurrentUser;
  searchParams: Promise<SearchParams>;
  basePath: string;
}) {
  const params = await searchParams;
  const filters = { q: one(params.q), role: one(params.role), status: one(params.status) };
  const page = Math.max(1, Number(one(params.page)) || 1);
  const { data, meta } = await backendGet<ListResponse<SocietyMember>>(`/api/societies/${societyId}/members${queryString({ ...filters, page })}`);
  const filtered = Boolean(filters.q || filters.role || filters.status);

  return (
    <>
      {/* Keyed so client-side navigation (Back) rebuilds the uncontrolled inputs from the URL. */}
      <MemberFilters key={queryString(filters)} {...filters} />
      <MembersList societyId={societyId} members={data} currentUserId={viewer.id} viewerRole={viewer.role} filtered={filtered} />
      <Pagination meta={meta} label="Member pages" hrefFor={(p) => `${basePath}${queryString({ ...filters, page: p })}`} />
    </>
  );
}

export function MembersSkeletonRows() {
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
