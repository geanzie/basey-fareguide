/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxAttempts: number // Maximum number of attempts in the time window
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier for the client (e.g., IP address, username)
 * @param config Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // No entry exists, create new one
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs
    rateLimitStore.set(identifier, {
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
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds
    }
  }

  // Increment counter
  entry.count++
  rateLimitStore.set(identifier, entry)

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime
  }
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

  // Fallback (not ideal, but prevents complete failure)
  return 'unknown'
}

/**
 * Standard rate limit configs for different endpoint types
 */
export const RATE_LIMITS = {
  // Very strict for login attempts
  AUTH_LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5 // 5 attempts per 15 minutes
  },
  // Moderate for password reset requests
  AUTH_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3 // 3 attempts per hour
  },
  // Moderate for registration
  AUTH_REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3 // 3 registrations per hour per IP
  },
  // Lenient for general API calls
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 60 // 60 requests per minute
  }
} as const
