import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { ApiError, readRetryAfter } from './api';
import type {
  LoginResponse,
  OAuthProvider,
  OAuthProvidersResponse,
  SocialSignupFields,
} from '@/types/auth';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Same reasoning as src/services/auth.ts: these are unauthenticated sign-in
// calls over rural mobile data, where a request can legitimately take most of a
// minute, so they wait far longer than the 12s the api.ts wrapper allows.
const AUTH_TIMEOUT_MS = 60000;
/** The provider list only gates a button, so it must not stall the screen. */
const PROVIDERS_TIMEOUT_MS = 8000;

async function requestJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  slowMessage: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };

    if (!res.ok) {
      throw new ApiError(
        res.status,
        data.message ?? 'Request failed. Please try again.',
        data.code,
        undefined,
        res.status === 429 ? readRetryAfter(res, data) : undefined,
      );
    }

    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(slowMessage);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * The deep link the server is asked to send the sign-in result back to.
 *
 * `baseyfare://oauth` in a build; `exp://<lan-ip>:8081/--/oauth` under Expo Go,
 * which a deployed server refuses unless that exact origin is named in its
 * OAUTH_DEV_REDIRECT_ORIGINS. Shared by the providers probe and the sign-in
 * itself so the two cannot ask about different URLs.
 */
export function getOAuthRedirectUri(): string {
  return Linking.createURL('oauth');
}

export interface OAuthProvidersResult {
  providers: OAuthProvider[];
  /**
   * False when this build's deep link is one the server will not return to, so
   * the login screen can disable the buttons with an explanation rather than
   * sending the user into a browser tab that dead-ends on a 400.
   */
  redirectSupported: boolean;
}

/**
 * The social providers this deployment has credentials for. The login screen
 * renders a button per entry, so an empty list (or a failed call) simply means
 * no social button rather than one that cannot work.
 */
export async function fetchOAuthProviders(): Promise<OAuthProvidersResult> {
  const redirect = encodeURIComponent(getOAuthRedirectUri());
  const data = await requestJson<OAuthProvidersResponse>(
    `/api/auth/oauth/providers?redirect=${redirect}`,
    { method: 'GET' },
    PROVIDERS_TIMEOUT_MS,
    'Could not reach the server.',
  );

  return {
    providers: Array.isArray(data.providers) ? data.providers : [],
    // A server predating this field still honours the redirect it always did,
    // so absence must not disable the buttons.
    redirectSupported: data.redirectSupported ?? true,
  };
}

/** Trades the handoff ticket from the deep link for a real session. */
export async function exchangeOAuthTicket(ticket: string): Promise<LoginResponse> {
  const data = await requestJson<LoginResponse>(
    '/api/auth/oauth/native/exchange',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    },
    AUTH_TIMEOUT_MS,
    'Your connection is too slow to finish signing in. Please try again.',
  );

  if (!data.token) {
    throw new Error('Server did not return auth token. Contact administrator.');
  }

  return data;
}

/**
 * Finishes a first-time social sign-up. The ticket goes in the body because the
 * app has no cookie jar for the one the web flow uses.
 */
export async function completeSocialSignup(
  fields: SocialSignupFields,
  signupTicket: string,
): Promise<LoginResponse> {
  const data = await requestJson<LoginResponse>(
    '/api/auth/oauth/complete',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, signupTicket }),
    },
    AUTH_TIMEOUT_MS,
    'Your connection is too slow to finish this right now. Nothing was lost — your details are still filled in, so you can try again.',
  );

  if (!data.token) {
    throw new Error('Server did not return auth token. Contact administrator.');
  }

  return data;
}

export type SocialSignInResult =
  /** Known user: exchange the ticket for a session. */
  | { kind: 'session'; ticket: string }
  /** No account yet: collect the remaining details, then post the ticket back. */
  | { kind: 'signup'; ticket: string }
  | { kind: 'error'; code: string }
  | { kind: 'cancelled' };

/**
 * Runs the provider sign-in in the system browser.
 *
 * The browser has its own cookie jar, so the server's httpOnly PKCE/state
 * cookie survives the round trip and the whole existing web flow is reused
 * unchanged — the client secret never comes near the app. The server hands the
 * result back on the deep link it was given.
 */
export async function startSocialSignIn(slug: string): Promise<SocialSignInResult> {
  const redirectUri = getOAuthRedirectUri();
  const startUrl = `${API_BASE}/api/auth/oauth/${slug}/start?redirect=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);

  if (result.type !== 'success') {
    // 'cancel' and 'dismiss' are the user backing out, which needs no message.
    return { kind: 'cancelled' };
  }

  return readSignInRedirect(result.url);
}

/** Parses the deep link the OAuth callback sent us back to. Exported for tests. */
export function readSignInRedirect(url: string): SocialSignInResult {
  const { queryParams } = Linking.parse(url);
  const read = (key: string): string | null => {
    const value = queryParams?.[key];
    return typeof value === 'string' && value ? value : null;
  };

  const error = read('error');
  if (error) {
    return { kind: 'error', code: error };
  }

  const ticket = read('ticket');
  if (ticket) {
    return { kind: 'session', ticket };
  }

  const signup = read('signup');
  if (signup) {
    return { kind: 'signup', ticket: signup };
  }

  // The browser returned to our scheme carrying nothing we recognise.
  return { kind: 'error', code: 'oauth_failed' };
}
