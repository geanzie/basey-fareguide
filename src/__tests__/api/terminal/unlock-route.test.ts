import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
  requireRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const loginMock = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
}))

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    TERMINAL_UNLOCK: { windowMs: 900000, maxAttempts: 5 },
  },
}))

const sessionMock = vi.hoisted(() => ({
  createTerminalUnlockSession: vi.fn(),
  applyTerminalUnlockCookie: vi.fn(),
  invalidateTerminalUnlockSession: vi.fn(),
  clearTerminalUnlockCookie: vi.fn(),
}))

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/login', () => loginMock)
vi.mock('@/lib/rateLimit', () => rateLimitMock)
vi.mock('@/lib/terminal/session', () => sessionMock)

import { DELETE, POST } from '@/app/api/terminal/unlock/route'

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.getClientIdentifier.mockReturnValue('client-1')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
  authMock.verifyAuthWithSelect.mockResolvedValue({
    id: 'enforcer-1',
    userType: 'ENFORCER',
    password: 'hashed-password',
  })
  authMock.requireRole.mockImplementation((user: unknown) => user)
})

describe('POST /api/terminal/unlock', () => {
  it('rejects incorrect passwords for enforcer unlock attempts', async () => {
    loginMock.verifyPassword.mockResolvedValueOnce(false)

    const response = await POST(
      new Request('http://localhost/api/terminal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      }) as never,
    )

    expect(response.status).toBe(401)
    expect(sessionMock.createTerminalUnlockSession).not.toHaveBeenCalled()
  })

  it('creates a server-backed unlock session for a valid enforcer password', async () => {
    loginMock.verifyPassword.mockResolvedValueOnce(true)
    sessionMock.createTerminalUnlockSession.mockResolvedValueOnce({
      token: 'unlock-token',
      expiresAt: new Date('2026-04-12T09:00:00.000Z'),
      lastActivityAt: new Date('2026-04-12T08:45:00.000Z'),
    })

    const response = await POST(
      new Request('http://localhost/api/terminal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(sessionMock.createTerminalUnlockSession).toHaveBeenCalledWith('enforcer-1')
    expect(sessionMock.applyTerminalUnlockCookie).toHaveBeenCalled()
    expect(json.unlocked).toBe(true)
  })

  it('maps auth failures through the shared auth error response', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(null)
    authMock.requireRole.mockImplementationOnce(() => {
      throw new Error('Unauthorized')
    })

    const response = await POST(
      new Request('http://localhost/api/terminal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'whatever' }),
      }) as never,
    )

    expect(response.status).toBe(401)
  })
})

describe('DELETE /api/terminal/unlock', () => {
  it('clears the terminal unlock state', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/terminal/unlock', {
        method: 'DELETE',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(sessionMock.invalidateTerminalUnlockSession).toHaveBeenCalled()
    expect(sessionMock.clearTerminalUnlockCookie).toHaveBeenCalled()
    expect(json.unlocked).toBe(false)
  })
})