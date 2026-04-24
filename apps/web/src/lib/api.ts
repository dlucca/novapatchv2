export interface Customer {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchCustomerInput {
  token: string;
  apiUrl: string;
}

/**
 * Fetches the authenticated customer. Throws ApiError on any failure.
 *
 * Errors:
 *  - status 4xx/5xx → ApiError with the backend envelope code/message
 *  - network / JSON parse → ApiError with code="network"
 */
export async function fetchCustomer({ token, apiUrl }: FetchCustomerInput): Promise<Customer> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/me/customer`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "network error",
      0,
    );
  }

  if (!res.ok) {
    let body: BackendErrorBody | undefined;
    try {
      body = (await res.json()) as BackendErrorBody;
    } catch {
      body = undefined;
    }
    const code = body?.error?.code ?? "unknown";
    const message = body?.error?.message ?? `request failed: ${res.status}`;
    throw new ApiError(code, message, res.status, body?.error?.details);
  }

  return (await res.json()) as Customer;
}
