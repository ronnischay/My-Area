import type { ApiErrorBody, ApiErrorCode } from "@/types/api";

/**
 * Browser → backend calls. Always same-origin `/api/...`: next.config.ts rewrites them to the Express
 * API (D015), so the httpOnly session cookie is first-party and sent automatically.
 * Server Components use `lib/server/backend.ts` instead.
 */

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

/** Parses a backend response: the body on success, an ApiError otherwise. Shared with the server-side client. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (isApiErrorBody(body)) {
      throw new ApiError({
        status: response.status,
        code: body.error.code,
        message: body.error.message,
        fieldErrors: body.error.details?.fieldErrors,
        requestId: body.error.requestId ?? requestId,
      });
    }
    throw new ApiError({
      status: response.status,
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
      requestId,
    });
  }

  return body as T;
}

export const networkError = () =>
  new ApiError({ status: 0, code: "NETWORK_ERROR", message: "We couldn't reach MyArea. Check your connection and try again." });

/** `body`: a plain object is sent as JSON; FormData as multipart (the browser sets the boundary). */
export async function apiFetch<T>(
  path: `/api/${string}`,
  init: Omit<RequestInit, "body"> & { body?: object | FormData } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }
  return readApiResponse<T>(response);
}
