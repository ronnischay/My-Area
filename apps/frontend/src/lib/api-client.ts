import type { ApiErrorBody, ApiErrorCode, HealthResponse } from "@/types/api";
import { apiBaseUrl } from "./config";

/** The ONLY module that calls fetch against the backend (docs/ARCHITECTURE.md §5). */

export type ClientErrorCode = ApiErrorCode | "NETWORK_ERROR";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | undefined;

  constructor(opts: {
    status: number;
    code: ClientErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.requestId = opts.requestId;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "We couldn't reach the server. Check your connection and try again.",
    });
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError({
        status: response.status,
        code: body.error.code,
        message: body.error.message,
        fieldErrors: body.error.details?.fieldErrors,
        requestId: body.error.requestId ?? response.headers.get("x-request-id") ?? undefined,
      });
    }
    throw new ApiError({
      status: response.status,
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
      requestId: response.headers.get("x-request-id") ?? undefined,
    });
  }

  return body as T;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
