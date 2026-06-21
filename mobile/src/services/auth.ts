import type { LoginRequest, LoginResponse } from '@/types/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: string | null;
  governmentId: string;
  idType: string;
  barangayResidence: string;
  username: string;
  password: string;
  userType: 'PUBLIC';
  privacyNoticeAcknowledged: true;
  privacyNoticeVersion: '2026-04-21';
}

export interface RegisterResponse {
  message: string;
  userId: string;
  canLoginImmediately: boolean;
}

export async function registerRequest(data: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json() as RegisterResponse & { message?: string };
  if (!res.ok) throw new Error((json as { message?: string }).message ?? 'Registration failed.');
  return json;
}
const LOGIN_TIMEOUT_MS = 15000;

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
