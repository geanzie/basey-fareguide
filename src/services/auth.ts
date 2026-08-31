import { api, ApiError, readRetryAfter } from './api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/types/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Registration and sign-in run over rural mobile data, where a request can
// legitimately take most of a minute. A short deadline turns a slow connection
// into a stream of failures, so these deliberately wait longer than the rest of
// the app does. Matches AUTH_FETCH_TIMEOUT_MS on the web client.
const AUTH_TIMEOUT_MS = 60000;

/** POST JSON with timeout; throws ApiError carrying status and retryAfter. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = (await res.json().catch(() => ({}))) as T & { message?: string };

    if (!res.ok) {
      throw new ApiError(
        res.status,
        data.message ?? 'Request failed. Please try again.',
        undefined,
        undefined,
        res.status === 429 ? readRetryAfter(res, data) : undefined,
      );
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Your connection is too slow to finish this right now. Nothing was lost — your details are still filled in, so you can try again.',
      );
    }
    throw err;
  }
}

export async function loginRequest(credentials: LoginRequest): Promise<LoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json() as LoginResponse & { message?: string };

    if (!res.ok) {
      throw new ApiError(
        res.status,
        data.message ?? 'Login failed.',
        undefined,
        undefined,
        res.status === 429 ? readRetryAfter(res, data) : undefined,
      );
    }

    if (!data.token) {
      throw new Error('Server did not return auth token. Contact administrator.');
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Your connection is too slow to finish signing in. Please try again.');
    }
    throw err;
  }
}

export async function logoutRequest(token: string): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function registerRequest(payload: RegisterRequest): Promise<RegisterResponse> {
  return postJson<RegisterResponse>('/api/auth/register', payload);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await postJson<{ message?: string }>('/api/auth/request-reset', { email });
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  await postJson<{ message?: string }>('/api/auth/reset-password', { email, otp, newPassword });
}

/** Authenticated change-password (Bearer token injected by the api wrapper). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/api/auth/change-password', { currentPassword, newPassword });
}
