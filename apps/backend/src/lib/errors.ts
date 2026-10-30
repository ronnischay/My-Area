/** Error codes from docs/API_CONTRACT.md §1 — keep in sync with the contract and frontend src/types/api.ts. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "SOCIETY_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "ALREADY_VOTED"
  | "VOTING_CLOSED"
  | "EMAIL_TAKEN"
  | "SOCIETY_ALREADY_EXISTS"
  | "USER_NOT_INVITED"
  | "INVITE_INVALID"
  | "FILE_TOO_LARGE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "MEDIA_UPLOAD_FAILED"
  | "SUGGESTIONS_UNAVAILABLE"
  | "SUGGESTION_FAILED"
  | "INTERNAL_ERROR";

/**
 * An expected, client-safe error. `message` and `details` are returned to the caller as-is,
 * so never put provider responses, SQL or secrets in them. `headers` are set on the error response.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly headers?: Record<string, string>,
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
