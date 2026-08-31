import { ApiError } from '@/services/api';
import {
  completeSocialSignup,
  exchangeOAuthTicket,
  fetchOAuthProviders,
  readSignInRedirect,
  startSocialSignIn,
} from '@/services/oauth';
import type { SocialSignupFields } from '@/types/auth';

// Jest only lets a module factory close over names prefixed with `mock`.
const mockOpenAuthSession = jest.fn();

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `baseyfare://${path}`,
  parse: (url: string) => {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const queryParams: Record<string, string> = {};

    for (const pair of query.split('&').filter(Boolean)) {
      const [key, value] = pair.split('=');
      queryParams[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
    }

    return { queryParams };
  },
}));

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  });
  (global as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}

const SIGNUP_FIELDS: SocialSignupFields = {
  phoneNumber: '09171234567',
  dateOfBirth: null,
  barangayResidence: 'Cogon',
  idType: null,
  governmentId: null,
  privacyNoticeAcknowledged: true,
  privacyNoticeVersion: '2026-04-21',
};

const SESSION_BODY = {
  user: { id: 'u1', username: 'juandc', userType: 'PUBLIC' },
  token: 'tok',
};

describe('oauth service', () => {
  afterEach(() => jest.clearAllMocks());

  describe('fetchOAuthProviders', () => {
    it('returns the configured providers', async () => {
      const fetchMock = mockFetch(200, { providers: [{ slug: 'google', label: 'Google' }] });
      const result = await fetchOAuthProviders();

      expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/oauth/providers');
      expect(result.providers).toEqual([{ slug: 'google', label: 'Google' }]);
    });

    it('returns an empty list when the server sends no providers array', async () => {
      mockFetch(200, {});
      await expect(fetchOAuthProviders()).resolves.toEqual({
        providers: [],
        redirectSupported: true,
      });
    });

    it('asks whether this build\'s deep link will be honoured', async () => {
      const fetchMock = mockFetch(200, { providers: [] });
      await fetchOAuthProviders();

      expect(fetchMock.mock.calls[0][0]).toContain(
        `redirect=${encodeURIComponent('baseyfare://oauth')}`,
      );
    });

    it('reports a redirect the server will refuse', async () => {
      mockFetch(200, { providers: [{ slug: 'google', label: 'Google' }], redirectSupported: false });

      await expect(fetchOAuthProviders()).resolves.toMatchObject({ redirectSupported: false });
    });

    it('assumes support on a server predating the field', async () => {
      mockFetch(200, { providers: [{ slug: 'google', label: 'Google' }] });

      await expect(fetchOAuthProviders()).resolves.toMatchObject({ redirectSupported: true });
    });
  });

  describe('exchangeOAuthTicket', () => {
    it('POSTs the ticket and returns the session', async () => {
      const fetchMock = mockFetch(200, SESSION_BODY);
      const res = await exchangeOAuthTicket('handoff-ticket');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/auth/oauth/native/exchange');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ ticket: 'handoff-ticket' });
      expect(res.token).toBe('tok');
    });

    it('throws rather than returning a session with no token', async () => {
      mockFetch(200, { user: SESSION_BODY.user });

      await expect(exchangeOAuthTicket('handoff-ticket')).rejects.toThrow(
        'Server did not return auth token. Contact administrator.',
      );
    });

    it('surfaces the server error code so the screen can explain the refusal', async () => {
      mockFetch(401, { message: 'expired', code: 'oauth_ticket_expired' });

      await expect(exchangeOAuthTicket('stale')).rejects.toMatchObject({
        status: 401,
        code: 'oauth_ticket_expired',
      });
      await expect(exchangeOAuthTicket('stale')).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('completeSocialSignup', () => {
    it('sends the signup ticket in the body, since the app has no cookie jar', async () => {
      const fetchMock = mockFetch(201, SESSION_BODY);
      await completeSocialSignup(SIGNUP_FIELDS, 'signup-ticket');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/auth/oauth/complete');
      expect(JSON.parse(init.body)).toEqual({
        ...SIGNUP_FIELDS,
        signupTicket: 'signup-ticket',
      });
    });
  });

  describe('startSocialSignIn', () => {
    it('opens the server start route with the app deep link as the redirect', async () => {
      mockOpenAuthSession.mockResolvedValue({
        type: 'success',
        url: 'baseyfare://oauth?ticket=abc',
      });

      const result = await startSocialSignIn('google');
      const [startUrl, returnUrl] = mockOpenAuthSession.mock.calls[0];

      expect(startUrl).toContain('/api/auth/oauth/google/start');
      expect(startUrl).toContain(`redirect=${encodeURIComponent('baseyfare://oauth')}`);
      expect(returnUrl).toBe('baseyfare://oauth');
      expect(result).toEqual({ kind: 'session', ticket: 'abc' });
    });

    it('treats a dismissed browser as a cancellation, not a failure', async () => {
      mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' });

      await expect(startSocialSignIn('google')).resolves.toEqual({ kind: 'cancelled' });
    });
  });

  describe('readSignInRedirect', () => {
    it('reads a handoff ticket', () => {
      expect(readSignInRedirect('baseyfare://oauth?ticket=abc')).toEqual({
        kind: 'session',
        ticket: 'abc',
      });
    });

    it('reads a signup ticket', () => {
      expect(readSignInRedirect('baseyfare://oauth?signup=xyz')).toEqual({
        kind: 'signup',
        ticket: 'xyz',
      });
    });

    it('reads an error code', () => {
      expect(readSignInRedirect('baseyfare://oauth?error=oauth_staff_account')).toEqual({
        kind: 'error',
        code: 'oauth_staff_account',
      });
    });

    it('reports a failure when the deep link carries nothing recognisable', () => {
      expect(readSignInRedirect('baseyfare://oauth')).toEqual({
        kind: 'error',
        code: 'oauth_failed',
      });
    });
  });
});
