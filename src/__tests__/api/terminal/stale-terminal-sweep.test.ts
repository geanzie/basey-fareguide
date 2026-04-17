/**
 * Phase 4 regression tests: terminal session cleanup.
 * Covers expireAllStaleTerminalUnlockSessions and the admin sweep endpoint.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  terminalUnlockSession: {
    deleteMany: vi.fn(),
  },
}))

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)

// ---------------------------------------------------------------------------
// Subject imports
// ---------------------------------------------------------------------------

import { expireAllStaleTerminalUnlockSessions } from '@/lib/terminal/session'
import { POST } from '@/app/api/admin/sweep/stale-terminal-sessions/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest() {
  return new Request('http://localhost/api/admin/sweep/stale-terminal-sessions', {
    method: 'POST',
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// 1. expireAllStaleTerminalUnlockSessions unit tests
// ---------------------------------------------------------------------------

describe('expireAllStaleTerminalUnlockSessions()', () => {
  it('deletes sessions whose expiresAt is at or before the given cutoff', async () => {
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 4 })
    const cutoff = new Date('2026-04-17T10:00:00Z')

    const count = await expireAllStaleTerminalUnlockSessions(cutoff)

    expect(count).toBe(4)
    expect(prismaMock.terminalUnlockSession.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: cutoff } },
    })
  })

  it('uses current time when no cutoff is provided', async () => {
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 0 })
    const before = Date.now()

    await expireAllStaleTerminalUnlockSessions()

    const after = Date.now()
    const { lte } = prismaMock.terminalUnlockSession.deleteMany.mock.calls[0][0].where.expiresAt
    expect(lte.getTime()).toBeGreaterThanOrEqual(before)
    expect(lte.getTime()).toBeLessThanOrEqual(after)
  })

  it('returns 0 when no stale sessions exist', async () => {
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 0 })

    const count = await expireAllStaleTerminalUnlockSessions(new Date())

    expect(count).toBe(0)
  })

  it('returns the exact count reported by prisma deleteMany', async () => {
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 17 })

    const count = await expireAllStaleTerminalUnlockSessions(new Date())

    expect(count).toBe(17)
  })
})

// ---------------------------------------------------------------------------
// 2. POST /api/admin/sweep/stale-terminal-sessions
// ---------------------------------------------------------------------------

describe('POST /api/admin/sweep/stale-terminal-sessions', () => {
  it('returns 200 with deletedCount when admin calls endpoint', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 3 })

    const res = await POST(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, deletedCount: 3 })
  })

  it('returns 0 deletedCount when no stale sessions exist', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.terminalUnlockSession.deleteMany.mockResolvedValueOnce({ count: 0 })

    const res = await POST(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.deletedCount).toBe(0)
  })

  it('rejects non-admin callers with 401', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
  })

  it('rejects enforcer callers with 403', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(403)
  })
})
