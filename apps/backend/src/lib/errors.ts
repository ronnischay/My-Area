/** Error codes from docs/API_CONTRACT.md §1 — keep in sync with the contract and frontend src/types/api.ts. */
export type ErrorCode =
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

/**
 * An expected, client-safe error. `message` and `details` are returned to the caller as-is,
 * so never put provider responses, SQL or secrets in them.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}
