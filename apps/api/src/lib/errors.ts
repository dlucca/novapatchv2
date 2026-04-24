/**
 * Stable, client-facing error codes. Add new codes here as the API grows.
 * The codes are semantic identifiers the frontend can branch on — they
 * should not change once shipped. The message is human-readable and may
 * change freely.
 */
export type ApiErrorCode =
  | "market_missing"
  | "market_empty"
  | "market_unknown"
  | "product_not_found"
  | "not_found"
  | "internal_error"
  | "validation_failed";

/**
 * HTTP status codes this helper is designed for (4xx + 5xx only).
 * Narrowing to a literal union keeps callers cast-free when spreading
 * into Hono's `c.json(body, status)`.
 */
export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ApiErrorResult {
  body: ApiErrorBody;
  status: ApiErrorStatus;
}

/**
 * Builds a typed error envelope. Call `c.json(...apiError(...))` in Hono handlers,
 * or spread the result manually when a handler needs more control.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: ApiErrorStatus,
): ApiErrorResult {
  return {
    body: { error: { code, message } },
    status,
  };
}
