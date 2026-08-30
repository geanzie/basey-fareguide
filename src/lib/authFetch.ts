/**
 * Fetch wrapper for the auth forms (registration, social sign-up completion).
 *
 * These forms are used by public users on rural mobile connections, so the
 * failure this has to handle well is a slow or flaky link — not a fast error.
 * Concretely it:
 *
 * - allows a long request timeout rather than the browser default, because a
 *   registration that takes 40 seconds is still a registration;
 * - retries only transport failures and 5xx, never a 4xx and never a 429, so a
 *   rejected attempt is never silently multiplied against the rate limit;
 * - surfaces `retryAfter` from a 429 so the caller can show a live countdown
 *   instead of a number that is stale the moment it renders.
 */

export const AUTH_FETCH_TIMEOUT_MS = 60_000
const MAX_TRANSPORT_RETRIES = 2
const RETRY_BACKOFF_MS = [1_000, 3_000]

export type AuthFetchFailure =
  | 'timeout' // request exceeded AUTH_FETCH_TIMEOUT_MS
  | 'network' // could not reach the server at all
  | 'rate-limited' // 429; `retryAfter` is set
  | 'rejected' // 4xx other than 429; the server declined the input
  | 'server' // 5xx after retries were exhausted

export type AuthFetchResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false
      status: number // 0 when no response was received
      data: T | null
      failure: AuthFetchFailure
      retryAfter?: number
    }

interface AuthFetchOptions {
  body: unknown
  timeoutMs?: number
  signal?: AbortSignal
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Reads `retryAfter` from the JSON body, falling back to the `Retry-After`
 * header. Returns undefined when neither is usable, so callers can fall back to
 * a plain message rather than rendering a countdown from NaN.
 */
function readRetryAfter(response: Response, data: unknown): number | undefined {
  const fromBody =
    data && typeof data === 'object' && 'retryAfter' in data
      ? (data as { retryAfter?: unknown }).retryAfter
      : undefined

  if (typeof fromBody === 'number' && Number.isFinite(fromBody) && fromBody > 0) {
    return Math.ceil(fromBody)
  }

  const fromHeader = Number(response.headers.get('Retry-After'))
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : undefined
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function authPost<T = Record<string, unknown>>(
  url: string,
  { body, timeoutMs = AUTH_FETCH_TIMEOUT_MS, signal }: AuthFetchOptions,
): Promise<AuthFetchResult<T>> {
  let lastFailure: AuthFetchFailure = 'network'
  let lastStatus = 0
  let lastData: T | null = null

  for (let attempt = 0; attempt <= MAX_TRANSPORT_RETRIES; attempt++) {
    const controller = new AbortController()
    const timedOut = { value: false }
    const timer = setTimeout(() => {
      timedOut.value = true
      controller.abort()
    }, timeoutMs)

    const abortOuter = () => controller.abort()
    signal?.addEventListener('abort', abortOuter)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const data = (await readJson(response)) as T | null
      lastStatus = response.status
      lastData = data

      if (response.ok) {
        return { ok: true, status: response.status, data: data as T }
      }

      if (response.status === 429) {
        return {
          ok: false,
          status: response.status,
          data,
          failure: 'rate-limited',
          retryAfter: readRetryAfter(response, data),
        }
      }

      // Any other 4xx is a decision about the submitted data. Retrying would
      // just spend another rate-limit attempt on the same rejection.
      if (response.status < 500) {
        return { ok: false, status: response.status, data, failure: 'rejected' }
      }

      lastFailure = 'server'
    } catch {
      // The caller cancelled (unmount, navigation): stop, do not retry.
      if (signal?.aborted) {
        return { ok: false, status: 0, data: null, failure: 'network' }
      }

      lastFailure = timedOut.value ? 'timeout' : 'network'
      lastStatus = 0
      lastData = null
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abortOuter)
    }

    // A timeout already cost the user the full wait; retrying doubles it with
    // no new information. Report it and let them decide.
    if (lastFailure === 'timeout') break

    if (attempt < MAX_TRANSPORT_RETRIES) {
      await delay(RETRY_BACKOFF_MS[attempt])
    }
  }

  return { ok: false, status: lastStatus, data: lastData, failure: lastFailure }
}

/**
 * User-facing copy for a non-rejection failure. Rejections carry the server's
 * own message, so they are not handled here.
 */
export function authFetchFailureMessage(failure: AuthFetchFailure): string {
  switch (failure) {
    case 'timeout':
      return 'Your connection is too slow to finish this right now. Nothing was lost — your details are still filled in, so you can try again.'
    case 'server':
      return 'The server had a problem. Please try again in a moment.'
    default:
      return 'Could not reach the server. Check your internet connection and try again.'
  }
}

/** Formats seconds as m:ss (or s seconds under a minute) for a countdown. */
export function formatRetryCountdown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  if (remainder === 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  return `${minutes}m ${String(remainder).padStart(2, '0')}s`
}
