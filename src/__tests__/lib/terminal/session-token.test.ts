import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { getTerminalUnlockToken } from '@/lib/terminal/session'

function makeRequest(cookieValue: string | null, headerValue: string | null) {
  return {
    cookies: {
      get: (_name: string) => (cookieValue == null ? undefined : { value: cookieValue }),
    },
    headers: {
      get: (name: string) =>
        name === 'x-terminal-unlock-token' ? headerValue : null,
    },
  } as never
}

describe('getTerminalUnlockToken', () => {
  it('prefers the unlock cookie when present (browser clients)', () => {
    expect(getTerminalUnlockToken(makeRequest('cookie-token', 'header-token'))).toBe('cookie-token')
  })

  it('falls back to the x-terminal-unlock-token header (mobile clients)', () => {
    expect(getTerminalUnlockToken(makeRequest(null, 'header-token'))).toBe('header-token')
  })

  it('returns null when neither cookie nor header is present', () => {
    expect(getTerminalUnlockToken(makeRequest(null, null))).toBeNull()
  })
})
