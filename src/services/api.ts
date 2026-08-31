import { useAuthStore } from '@/store/authStore';
import { useTerminalUnlockStore } from '@/store/terminalUnlockStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /**
     * Structured payload some errors carry alongside the message — e.g. the
     * drop-off point /api/routes/calculate offers when a pin is walk-only.
     */
    public readonly details?: unknown,
    /**
     * Seconds until a rate-limited request may be retried. Set on 429 only.
     * Screens use it to count down instead of showing a fixed number that is
     * already wrong by the time it renders.
     */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Seconds until a 429 may be retried: the `retryAfter` field the auth routes
 * put in the body, falling back to the standard `Retry-After` header.
 */
export function readRetryAfter(res: Response, body: unknown): number | undefined {
  const fromBody =
    body && typeof body === 'object' && 'retryAfter' in body
      ? (body as { retryAfter?: unknown }).retryAfter
      : undefined;

  if (typeof fromBody === 'number' && Number.isFinite(fromBody) && fromBody > 0) {
    return Math.ceil(fromBody);
  }

  const fromHeader = Number(res.headers?.get('Retry-After'));
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : undefined;
}

/** Formats seconds as a countdown a passenger can read at a glance. */
export function formatRetryCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (remainder === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

/**
 * How long any ordinary request may hang before we give up on it.
 *
 * There was no deadline here at all, so on a dead connection a fare quote sat
 * on its spinner until the platform socket eventually gave out — minutes, on
 * some Android builds. Rural riders are the people most likely to hit that and
 * least able to wait it out. Deliberately far shorter than the 60 s in
 * auth.ts: signing in is a one-shot the rider is watching, while a quote has an
 * offline answer waiting behind it and should reach it quickly.
 */
const REQUEST_TIMEOUT_MS = 12000;

/** Thrown when a request passes REQUEST_TIMEOUT_MS. Callers treat it as offline. */
export const REQUEST_TIMEOUT_CODE = 'REQUEST_TIMEOUT';

/** True for anything that means "we never got an answer from the server". */
export function isOfflineError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // A real HTTP status means the server answered; that is not being offline.
    return error.status === 0;
  }
  return error instanceof TypeError;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { token, clearSession } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // The QR terminal unlock secret travels in a header (no cookie jar on mobile).
  const unlockToken = useTerminalUnlockStore.getState().unlockToken;
  if (unlockToken) {
    headers['x-terminal-unlock-token'] = unlockToken;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    // A timeout and a refused connection are the same thing to a caller: no
    // answer came back. Status 0 marks that, so isOfflineError can route the
    // fare calculator to its on-device path instead of showing a failure.
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'The connection timed out.', REQUEST_TIMEOUT_CODE);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Keep the local unlock expiry in sync with the server's idle-timeout refresh.
  const refreshedExpiry = res.headers.get('x-terminal-unlock-expires-at');
  if (refreshedExpiry) {
    const { unlockToken: current, setUnlock } = useTerminalUnlockStore.getState();
    if (current) setUnlock(current, refreshedExpiry);
  }

  if (res.status === 401) {
    await clearSession();
    useTerminalUnlockStore.getState().clearUnlock();
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    const body = json as { message?: string; code?: string; details?: unknown };
    throw new ApiError(
      res.status,
      body?.message ?? `HTTP ${res.status}`,
      body?.code,
      body?.details,
      res.status === 429 ? readRetryAfter(res, json) : undefined,
    );
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
