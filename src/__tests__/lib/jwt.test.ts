import { getTokenExpiryMs, isTokenExpired } from '@/lib/jwt';

/** base64url-encode a string (Node Buffer is available in the jest env). */
function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeToken(payload: object): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

describe('getTokenExpiryMs', () => {
  it('returns exp in ms', () => {
    const token = makeToken({ exp: 1_700_000_000, userId: 'u1' });
    expect(getTokenExpiryMs(token)).toBe(1_700_000_000_000);
  });

  it('returns null for a malformed token', () => {
    expect(getTokenExpiryMs('not-a-token')).toBeNull();
  });

  it('returns null when exp is missing', () => {
    expect(getTokenExpiryMs(makeToken({ userId: 'u1' }))).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('is false for a future exp', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeToken({ exp: future }))).toBe(false);
  });

  it('is true for a past exp', () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(isTokenExpired(makeToken({ exp: past }))).toBe(true);
  });

  it('is true (fail-safe) when expiry cannot be read', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });
});
