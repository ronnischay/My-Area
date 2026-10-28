/**
 * Mirrored API contract types — source of truth: docs/API_CONTRACT.md.
 * There is no shared package yet (docs/DECISIONS.md D003); when the contract changes,
 * update the backend, API_CONTRACT.md and this file in the same change.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "FILE_TOO_LARGE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "MEDIA_UPLOAD_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: { fieldErrors?: Record<string, string[]> } & Record<string, unknown>;
    requestId?: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: Pagination;
}

export interface HealthResponse {
  status: "ok";
}
