import { ApiError, type Subscription } from "./api";

interface MutationBase {
  token: string;
  apiUrl: string;
  id: string;
}

async function postMutation(
  path: string,
  token: string,
  body?: unknown,
): Promise<Subscription> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw new ApiError(
      "network",
      err instanceof Error ? err.message : "network error",
      0,
    );
  }
  if (!res.ok) {
    let parsed: { error: { code: string; message: string; details?: unknown } } | undefined;
    try {
      parsed = (await res.json()) as typeof parsed;
    } catch {
      parsed = undefined;
    }
    throw new ApiError(
      parsed?.error?.code ?? "unknown",
      parsed?.error?.message ?? `request failed: ${res.status}`,
      res.status,
      parsed?.error?.details,
    );
  }
  return (await res.json()) as Subscription;
}

export function pauseSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/pause`, token);
}

export function resumeSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/resume`, token);
}

export function cancelSubscription({ token, apiUrl, id }: MutationBase) {
  return postMutation(`${apiUrl}/me/subscriptions/${id}/cancel`, token);
}

export interface ChangeFrequencyInput extends MutationBase {
  intervalDays: 30 | 60 | 90;
}

export function changeFrequency({
  token,
  apiUrl,
  id,
  intervalDays,
}: ChangeFrequencyInput) {
  return postMutation(
    `${apiUrl}/me/subscriptions/${id}/frequency`,
    token,
    { intervalDays },
  );
}
