import { ApiError } from "@/lib/api-client";
import { isCategory, isStatus } from "@/lib/reports";
import type { DataResponse, ListResponse, Report, ReportListQuery, ReportSummary } from "@/types/api";
import { backendGet } from "./backend";

type Search = Record<string, string | string[] | undefined>;
const one = (value: Search[string]) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** URL search params → a valid list query. Unknown values are dropped instead of causing a 400. */
export function reportQueryFrom(params: Search, pageSize = 12): ReportListQuery & { page: number; pageSize: number } {
  const status = one(params.status);
  const category = one(params.category);
  const q = one(params.q)?.slice(0, 100);
  return {
    page: Math.max(1, Math.floor(Number(one(params.page))) || 1),
    pageSize,
    ...(isStatus(status) ? { status } : {}),
    ...(isCategory(category) ? { category } : {}),
    ...(q ? { q } : {}),
    ...(one(params.mine) === "true" ? { mine: true } : {}),
  };
}

export function toSearch(query: ReportListQuery & { page?: number }, { keepPageSize = false } = {}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.mine) params.set("mine", "true");
  if (query.sort === "oldest") params.set("sort", "oldest"); // newest is the default
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (keepPageSize && query.pageSize) params.set("pageSize", String(query.pageSize));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function listReports(query: ReportListQuery & { page: number; pageSize: number }) {
  return backendGet<ListResponse<ReportSummary>>(`/api/reports${toSearch(query, { keepPageSize: true })}`);
}

/** null for unknown, malformed or another society's id (the API answers 404/400 for all of them). */
export async function getReport(id: string): Promise<Report | null> {
  try {
    const { data } = await backendGet<DataResponse<Report>>(`/api/reports/${encodeURIComponent(id)}`);
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
