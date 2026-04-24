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
      // Per-user authenticated fetch must never be cached by the Next.js RSC layer.
      cache: "no-store",
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

export interface Subscription {
  id: string;
  productSlug: string;
  intervalDays: number;
  unitPrice: number;
  quantity: number;
  market: string;
  currency: string;
  status:
    | "active"
    | "paused"
    | "canceled"
    | "past_due"
    | "delayed_oos";
  nextBillingDate: string;
  createdAt: string;
  updatedAt: string;
  canceledAt: string | null;
}

export interface OrderItemSummary {
  productSlug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isSubscription: boolean;
  intervalDays: number | null;
}

export interface Order {
  id: string;
  createdAt: string;
  status: string;
  market: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  shipping: number;
  total: number;
  paymentChargeId: string | null;
  items: OrderItemSummary[];
}

interface FetchListInput {
  token: string;
  apiUrl: string;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
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
  return (await res.json()) as T;
}

export async function fetchSubscriptions({
  token,
  apiUrl,
}: FetchListInput): Promise<Subscription[]> {
  const data = await fetchJson<{ subscriptions: Subscription[] }>(
    `${apiUrl}/me/subscriptions`,
    token,
  );
  return data.subscriptions;
}

export async function fetchOrders({
  token,
  apiUrl,
}: FetchListInput): Promise<Order[]> {
  const data = await fetchJson<{ orders: Order[] }>(
    `${apiUrl}/me/orders`,
    token,
  );
  return data.orders;
}
