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
  | "validation_failed"
  | "invalid_input"
  | "auth_missing"
  | "auth_malformed"
  | "auth_invalid"
  | "discount_not_found"
  | "discount_below_minimum"
  | "discount_max_uses_reached"
  | "discount_max_per_customer_reached"
  | "idempotency_key_missing"
  | "payment_declined"
  | "gateway_error"
  | "subscription_invalid_state";

/**
 * HTTP status codes this helper is designed for (4xx + 5xx only).
 * Narrowing to a literal union keeps callers cast-free when spreading
 * into Hono's `c.json(body, status)`.
 */
export type ApiErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /**
     * Optional, shape-free field for structured extras (e.g. Zod field errors
     * on a `validation_failed` response). Frontend parses it per-code.
     */
    details?: unknown;
  };
}

export interface ApiErrorResult {
  body: ApiErrorBody;
  status: ApiErrorStatus;
}

/**
 * Builds a typed error envelope. Call `c.json(...apiError(...))` in Hono handlers,
 * or spread the result manually when a handler needs more control.
 *
 * Pass `details` when the code needs structured extra data (e.g. per-field
 * validation errors). Omit otherwise — the field is absent from the JSON.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: ApiErrorStatus,
  details?: unknown,
): ApiErrorResult {
  const error: ApiErrorBody["error"] =
    details === undefined ? { code, message } : { code, message, details };
  return { body: { error }, status };
}
