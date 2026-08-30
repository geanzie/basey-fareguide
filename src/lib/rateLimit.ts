/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis or a dedicated rate limiting service
 *
 * Two usage styles:
 *
 * 1. `checkRateLimit` — check and count in one call. Right for endpoints where
 *    every request is inherently an "attempt" (login, terminal unlock).
 *
 * 2. `peekRateLimit` + `consumeRateLimit` — check up front, count only once the
 *    outcome is known. Right for registration, where a request that fails
 *    because the user's connection dropped, or that succeeds, should not spend
 *    the caller's budget. See `src/app/api/auth/register/route.ts`.
 *
 * Every entry is namespaced by `config.name`, so two endpoints sharing an
 * identifier (the client IP, typically) do not share a counter.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Lazy cleanup: run every CLEANUP_CALL_INTERVAL calls to checkRateLimit.
// Avoids a background setInterval that does not work reliably in serverless environments.
let _cleanupCallCounter = 0
const CLEANUP_CALL_INTERVAL = 100

function maybeCleanupExpiredEntries(now: number) {
  _cleanupCallCounter++
  if (_cleanupCallCounter % CLEANUP_CALL_INTERVAL !== 0) return
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

export interface RateLimitConfig {
  /**
   * Namespace for this limit. Entries are stored under `${name}:${identifier}`,
   * so endpoints that key on the same IP keep independent counters and
   * independent window lengths.
   */
  name: string
  windowMs: number // Time window in milliseconds
  maxAttempts: number // Maximum number of attempts in the time window
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

function storeKey(config: RateLimitConfig, identifier: string): string {
  return `${config.name}:${identifier}`
}

/**
 * Check if a request should be rate limited, counting it as an attempt.
 * @param identifier Unique identifier for the client (e.g., IP address, username)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  maybeCleanupExpiredEntries(now)
  const key = storeKey(config, identifier)
  const entry = rateLimitStore.get(key)

  // No entry exists, create new one
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs
    rateLimitStore.set(key, {
      count: 1,
      resetTime
    })
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetTime
    }
  }

  // Entry exists and is still valid
  if (entry.count >= config.maxAttempts) {
    // Rate limit exceeded.
    // Deliberately does not touch count or resetTime: a blocked attempt must
    // never push the reset time forward, or the countdown shown to the user
    // stops decreasing and the limit becomes an indefinite lockout.
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds
    }
  }

  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Read-only budget check. Never mutates the store, so merely looking at a
 * limit does not start a window or spend an attempt.
 */
export function peekRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(storeKey(config, identifier))

  if (!entry || entry.resetTime < now) {
    return {
      success: true,
      remaining: config.maxAttempts,
      resetTime: now + config.windowMs
    }
  }

  if (entry.count >= config.maxAttempts) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    }
  }

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Spend one attempt against a limit. Call this once the outcome of a request
 * is known — not before.
 *
 * A saturated entry is left alone rather than incremented further, so its
 * window can never be extended by continued hammering.
 */
export function consumeRateLimit(identifier: string, config: RateLimitConfig): void {
  const now = Date.now()
  maybeCleanupExpiredEntries(now)
  const key = storeKey(config, identifier)
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return
  }

  if (entry.count >= config.maxAttempts) return

  entry.count++
  rateLimitStore.set(key, entry)
}

/**
 * Log a rate limit rejection. There is no other signal that a limit fired, so
 * without this a lockout can only be diagnosed from a user's screenshot.
 *
 * `keyKind` describes what the limit was bucketed on; the identifier itself is
 * never logged, because it is an IP or an email address.
 */
export function logRateLimitHit(
  config: RateLimitConfig,
  keyKind: 'ip' | 'email' | 'oauth' | 'user',
  retryAfter: number | undefined
): void {
  console.warn('[RATE LIMIT]', { name: config.name, keyKind, retryAfter })
}

/**
 * Test-only: drop all counters so cases cannot leak state into each other.
 */
export function __resetRateLimitStore(): void {
  rateLimitStore.clear()
  _cleanupCallCounter = 0
}

/**
 * Get client identifier from request (IP address)
 * Falls back to a default if IP cannot be determined
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers (for proxy/CDN scenarios)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback (not ideal, but prevents complete failure).
  // Note: when neither header is present, every client collapses into this one
  // bucket. Check that the reverse proxy in front of the app sets a forwarded
  // header before relying on any IP-keyed limit below.
  return 'unknown'
}

/**
 * Standard rate limit configs for different endpoint types
 */
export const RATE_LIMITS = {
  // Very strict for login attempts
  AUTH_LOGIN: {
    name: 'auth-login',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5 // 5 attempts per 15 minutes
  },
  // Strict for privileged terminal activation attempts
  TERMINAL_UNLOCK: {
    name: 'terminal-unlock',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5 // 5 failed unlock attempts per 15 minutes
  },
  // Moderate for password reset requests
  AUTH_RESET: {
    name: 'auth-reset',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3 // 3 attempts per hour
  },
  // Registration attempts the server actually rejected (duplicate email, bad
  // input). Keyed on the email being registered, not the IP, so one household
  // or one shared telco NAT cannot lock out a barangay. Generous, because a
  // user correcting a typo is the common case, not an attacker.
  REGISTER_REJECT: {
    name: 'register-reject',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 10
  },
  // Accounts actually created, per IP. This is the anti-mass-signup control.
  REGISTER_CREATE: {
    name: 'register-create',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 5
  },
  // Coarse flood guard applied before the request body is parsed.
  REGISTER_IP_BURST: {
    name: 'register-burst',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 60
  },
  // Social sign-up completion. The caller already proved identity with the
  // provider, so this only needs to stop hammering, not signup abuse.
  OAUTH_COMPLETE_REJECT: {
    name: 'oauth-complete-reject',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 20
  },
  // The two OAuth redirect legs. Cheap, and a user retrying a failed sign-in
  // hits them repeatedly, so they get their own generous budget instead of
  // eating into registration.
  OAUTH_REDIRECT: {
    name: 'oauth-redirect',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 30
  },
  // Lenient for general API calls
  API_GENERAL: {
    name: 'api-general',
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 60
  }
} as const
