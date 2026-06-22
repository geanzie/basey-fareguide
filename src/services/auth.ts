import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/types/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const LOGIN_TIMEOUT_MS = 15000;
const REQUEST_TIMEOUT_MS = 15000;

/** POST JSON with timeout; throws Error(data.message) on non-ok response. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      throw new Error(data.message ?? 'Request failed. Please try again.');
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

export async function loginRequest(credentials: LoginRequest): Promise<LoginResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

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
      throw new Error(data.message ?? 'Login failed.');
    }

    if (!data.token) {
      throw new Error('Server did not return auth token. Contact administrator.');
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Login request timed out. Please try again.');
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
