import { useAuthStore } from '@/store/authStore';
import { useTerminalUnlockStore } from '@/store/terminalUnlockStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

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
    const body = json as { message?: string; code?: string };
    throw new ApiError(res.status, body?.message ?? `HTTP ${res.status}`, body?.code);
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
