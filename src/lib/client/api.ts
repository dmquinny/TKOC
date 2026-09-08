/**
 * Thin fetch wrapper used by every dashboard page. Responses are JSON; any
 * non-2xx status is thrown as an ApiError carrying the server's message and
 * request reference so pages can show it without re-implementing parsing.
 */
export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You are not allowed to do that.';
  if (status === 404) return 'That could not be found.';
  if (status === 429) return 'You are doing that too quickly. Try again shortly.';
  if (status >= 500) return 'The realm is having trouble. Please try again.';
  return 'Something went wrong.';
}

async function handle<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = (data ?? {}) as { error?: unknown; requestId?: unknown };
    const message = typeof body.error === 'string' && body.error.trim()
      ? body.error
      : fallbackMessage(response.status);
    throw new ApiError(message, response.status, typeof body.requestId === 'string' ? body.requestId : undefined);
  }
  return data as T;
}

export async function apiGet<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  return handle<T>(response);
}

export async function apiPost<T>(url: string, body: unknown = {}, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
  });
  return handle<T>(response);
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Route the browser to sign-in or province founding when auth fails. */
export function authRedirectFor(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) return '/';
  if (error.status === 404 && /province/i.test(error.message)) return '/province/create';
  return null;
}
