import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetRateLimitStore,
  checkRateLimit,
  consumeRateLimit,
  getClientIdentifier,
  peekRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
} from '@/lib/rateLimit'

const CONFIG: RateLimitConfig = { name: 'test-a', windowMs: 60_000, maxAttempts: 3 }
const OTHER_CONFIG: RateLimitConfig = { name: 'test-b', windowMs: 60_000, maxAttempts: 3 }

beforeEach(() => {
  __resetRateLimitStore()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  __resetRateLimitStore()
})

describe('checkRateLimit', () => {
  it('allows up to maxAttempts then blocks', () => {
    expect(checkRateLimit('ip', CONFIG).success).toBe(true)
    expect(checkRateLimit('ip', CONFIG).success).toBe(true)
    expect(checkRateLimit('ip', CONFIG).success).toBe(true)
    expect(checkRateLimit('ip', CONFIG).success).toBe(false)
  })

  it('never extends the reset time when blocked', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) checkRateLimit('ip', CONFIG)

    const first = checkRateLimit('ip', CONFIG)
    expect(first.success).toBe(false)

    let previous = first.retryAfter as number

    // Hammer the limit the way a frustrated user would. The countdown must
    // strictly decrease — this is the regression that made lockouts feel
    // permanent.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1_000)
      const result = checkRateLimit('ip', CONFIG)
      expect(result.success).toBe(false)
      expect(result.resetTime).toBe(first.resetTime)
      expect(result.retryAfter as number).toBeLessThan(previous)
      previous = result.retryAfter as number
    }
  })

  it('lets the identifier through again once the window elapses', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) checkRateLimit('ip', CONFIG)
    expect(checkRateLimit('ip', CONFIG).success).toBe(false)

    vi.advanceTimersByTime(CONFIG.windowMs + 1)
    expect(checkRateLimit('ip', CONFIG).success).toBe(true)
  })

  it('keeps separate counters for configs with different names', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) checkRateLimit('same-ip', CONFIG)
    expect(checkRateLimit('same-ip', CONFIG).success).toBe(false)

    // The same identifier under another namespace must be untouched. This is
    // the collision that let the OAuth redirect legs spend the registration
    // budget before the signup form was even shown.
    expect(checkRateLimit('same-ip', OTHER_CONFIG).success).toBe(true)
  })

  it('does not throw in serverless-like environments without setInterval', () => {
    for (let i = 0; i < 250; i++) {
      expect(checkRateLimit(`ip-${i}`, RATE_LIMITS.AUTH_LOGIN).success).toBe(true)
    }
  })
})

describe('peekRateLimit', () => {
  it('does not create an entry or spend an attempt', () => {
    expect(peekRateLimit('ip', CONFIG)).toMatchObject({
      success: true,
      remaining: CONFIG.maxAttempts,
    })

    // Looking a hundred times must leave the full budget available.
    for (let i = 0; i < 100; i++) peekRateLimit('ip', CONFIG)

    expect(checkRateLimit('ip', CONFIG).remaining).toBe(CONFIG.maxAttempts - 1)
  })

  it('reports a saturated budget without mutating it', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) consumeRateLimit('ip', CONFIG)

    const first = peekRateLimit('ip', CONFIG)
    expect(first.success).toBe(false)

    vi.advanceTimersByTime(5_000)
    const second = peekRateLimit('ip', CONFIG)
    expect(second.resetTime).toBe(first.resetTime)
    expect(second.retryAfter as number).toBeLessThan(first.retryAfter as number)
  })
})

describe('consumeRateLimit', () => {
  it('spends attempts until the budget is gone', () => {
    consumeRateLimit('ip', CONFIG)
    expect(peekRateLimit('ip', CONFIG).remaining).toBe(CONFIG.maxAttempts - 1)

    consumeRateLimit('ip', CONFIG)
    consumeRateLimit('ip', CONFIG)
    expect(peekRateLimit('ip', CONFIG).success).toBe(false)
  })

  it('does not extend the window once saturated', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) consumeRateLimit('ip', CONFIG)
    const saturated = peekRateLimit('ip', CONFIG)

    vi.advanceTimersByTime(10_000)
    consumeRateLimit('ip', CONFIG)
    consumeRateLimit('ip', CONFIG)

    expect(peekRateLimit('ip', CONFIG).resetTime).toBe(saturated.resetTime)
  })

  it('starts a fresh window after the previous one expired', () => {
    for (let i = 0; i < CONFIG.maxAttempts; i++) consumeRateLimit('ip', CONFIG)
    vi.advanceTimersByTime(CONFIG.windowMs + 1)

    consumeRateLimit('ip', CONFIG)
    expect(peekRateLimit('ip', CONFIG).remaining).toBe(CONFIG.maxAttempts - 1)
  })
})

describe('RATE_LIMITS', () => {
  it('gives every config a unique namespace', () => {
    const names = Object.values(RATE_LIMITS).map((config) => config.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('keeps the OAuth redirect legs off the registration budget', () => {
    expect(RATE_LIMITS.OAUTH_REDIRECT.name).not.toBe(RATE_LIMITS.OAUTH_COMPLETE_REJECT.name)
    expect(RATE_LIMITS.OAUTH_REDIRECT.name).not.toBe(RATE_LIMITS.REGISTER_REJECT.name)
  })

  it('leaves the signup form usable after a full Google sign-in round trip', () => {
    // The reported bug: /oauth/start and /oauth/callback shared a counter with
    // the signup form, so the user reached "Finish your account" with almost no
    // budget left and was locked out on their first or second submit.
    const ip = '203.0.113.9'
    const providerAccountId = 'google-account-1'

    for (let round = 0; round < 5; round++) {
      expect(checkRateLimit(ip, RATE_LIMITS.OAUTH_REDIRECT).success).toBe(true) // start
      expect(checkRateLimit(ip, RATE_LIMITS.OAUTH_REDIRECT).success).toBe(true) // callback
    }

    expect(peekRateLimit(providerAccountId, RATE_LIMITS.OAUTH_COMPLETE_REJECT)).toMatchObject({
      success: true,
      remaining: RATE_LIMITS.OAUTH_COMPLETE_REJECT.maxAttempts,
    })
  })

  it('lets a user correct a rejected signup many times before blocking', () => {
    const providerAccountId = 'google-account-1'

    // Nine corrections — mistyped phone number, wrong ID length — must all be
    // allowed. Slow connections make retries normal, not suspicious.
    for (let attempt = 0; attempt < RATE_LIMITS.OAUTH_COMPLETE_REJECT.maxAttempts - 1; attempt++) {
      expect(peekRateLimit(providerAccountId, RATE_LIMITS.OAUTH_COMPLETE_REJECT).success).toBe(true)
      consumeRateLimit(providerAccountId, RATE_LIMITS.OAUTH_COMPLETE_REJECT)
    }

    expect(peekRateLimit(providerAccountId, RATE_LIMITS.OAUTH_COMPLETE_REJECT).success).toBe(true)
  })
})

describe('getClientIdentifier', () => {
  it('prefers the first x-forwarded-for entry', () => {
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    })
    expect(getClientIdentifier(request)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then to a shared bucket', () => {
    expect(
      getClientIdentifier(new Request('https://example.test', { headers: { 'x-real-ip': '198.51.100.4' } })),
    ).toBe('198.51.100.4')

    expect(getClientIdentifier(new Request('https://example.test'))).toBe('unknown')
  })
})
