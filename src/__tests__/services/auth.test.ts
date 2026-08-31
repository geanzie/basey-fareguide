import { ApiError } from '@/services/api';
import {
  registerRequest,
  requestPasswordReset,
  resetPasswordWithOtp,
} from '@/services/auth';
import type { RegisterRequest } from '@/types/auth';

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  (global as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}

const REGISTER_PAYLOAD: RegisterRequest = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  phoneNumber: '09171234567',
  email: 'juan@example.com',
  dateOfBirth: null,
  governmentId: 'ID-123',
  idType: 'NATIONAL_ID',
  barangayResidence: 'Poblacion',
  username: 'juandc',
  password: 'password123',
  userType: 'PUBLIC',
  privacyNoticeAcknowledged: true,
  privacyNoticeVersion: '2026-04-21',
};

describe('auth service', () => {
  afterEach(() => jest.clearAllMocks());

  it('registerRequest POSTs to /api/auth/register and returns body', async () => {
    const fetchMock = mockFetch(201, { user: { id: 'u1' }, token: 'tok' });
    const res = await registerRequest(REGISTER_PAYLOAD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/register');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ username: 'juandc', email: 'juan@example.com' });
    expect(res.token).toBe('tok');
  });

  it('registerRequest surfaces retryAfter from a 429 so the screen can count down', async () => {
    mockFetch(429, {
      message: 'Too many registration attempts. Please try again in 420 seconds.',
      retryAfter: 420,
    });

    await expect(registerRequest(REGISTER_PAYLOAD)).rejects.toMatchObject({
      status: 429,
      retryAfter: 420,
    });
  });

  it('registerRequest raises a plain rejection without a retryAfter', async () => {
    mockFetch(409, { message: 'Email address already registered' });

    const error = await registerRequest(REGISTER_PAYLOAD).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).retryAfter).toBeUndefined();
    expect((error as ApiError).message).toBe('Email address already registered');
  });

  it('requestPasswordReset sends { email } to /api/auth/request-reset', async () => {
    const fetchMock = mockFetch(200, { message: 'ok' });
    await requestPasswordReset('juan@example.com');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/request-reset');
    expect(JSON.parse(init.body)).toEqual({ email: 'juan@example.com' });
  });

  it('resetPasswordWithOtp sends { email, otp, newPassword } to /api/auth/reset-password', async () => {
    const fetchMock = mockFetch(200, { message: 'ok' });
    await resetPasswordWithOtp('juan@example.com', '123456', 'newpass123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/reset-password');
    expect(JSON.parse(init.body)).toEqual({
      email: 'juan@example.com',
      otp: '123456',
      newPassword: 'newpass123',
    });
  });

  it('throws the server message on a non-ok response', async () => {
    mockFetch(400, { message: 'Email already registered' });
    await expect(registerRequest(REGISTER_PAYLOAD)).rejects.toThrow('Email already registered');
  });
});
