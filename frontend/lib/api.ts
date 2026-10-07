'use client';

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

// No tokens in JavaScript at all. The browser stores httpOnly cookies set by the API and sends them
// automatically because every request uses credentials: 'include'.
function request(path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

// If the 15-min access cookie expired, ask the API for a new pair (using the refresh cookie) and retry once.
// Parallel requests share a single refresh call.
let refreshing: Promise<boolean> | null = null;
function refresh(): Promise<boolean> {
  refreshing ??= request('/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Calls the API and returns json.data. Throws ApiError on failure. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await request(path, init);
  if (res.status === 401 && !path.startsWith('/auth/') && (await refresh())) res = await request(path, init);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong', e?.details);
  }
  return json.data as T;
}

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
