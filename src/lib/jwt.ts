/**
 * Minimal JWT helpers — read claims without a dependency.
 * Only decodes the payload (no signature verification; the server is the
 * authority). Self-contained base64url decode so it works regardless of
 * whether `atob` / `Buffer` exist in the RN runtime.
 */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  let bc = 0;
  let bs = 0;

  for (let i = 0; i < str.length; i += 1) {
    const code = B64_CHARS.indexOf(str[i]);
    if (code === -1) continue;
    const cond = bc % 4;
    bs = cond ? bs * 64 + code : code;
    bc += 1;
    if (cond) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return output;
}

/**
 * Returns the token's payload claims, or null if they cannot be read.
 * Unverified — only ever use this for display or for expiry checks that fail
 * safe, never to decide what a user is allowed to do.
 */
export function decodeTokenPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(base64Decode(base64));
    return typeof claims === 'object' && claims !== null ? claims : null;
  } catch {
    return null;
  }
}

/** Returns the token's expiry in epoch ms, or null if it can't be read. */
export function getTokenExpiryMs(token: string): number | null {
  const exp = decodeTokenPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/** True when the token is past its `exp` (or has no readable expiry — fail safe). */
export function isTokenExpired(token: string, skewMs = 0): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs == null) return true;
  return expiryMs <= Date.now() - skewMs;
}
