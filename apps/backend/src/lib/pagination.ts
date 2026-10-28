import { z } from "zod";

/** `page` and `pageSize` query params (docs/API_CONTRACT.md: page ≥ 1, pageSize 1–50, default 20). */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginationMeta(page: number, pageSize: number, total: number): Pagination {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export function offsetOf(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
