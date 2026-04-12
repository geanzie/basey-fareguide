import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  requireRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const historyMock = vi.hoisted(() => ({
  listRecentTerminalScanHistory: vi.fn(),
}))

const sessionMock = vi.hoisted(() => ({
  getTerminalUnlockSession: vi.fn(),
  touchTerminalUnlockSession: vi.fn(),
  applyTerminalUnlockCookie: vi.fn(),
  clearTerminalUnlockCookie: vi.fn(),
  getTerminalUnlockToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/terminal/history', () => historyMock)
vi.mock('@/lib/terminal/session', () => sessionMock)

import { GET } from '@/app/api/terminal/history/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuth.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  authMock.requireRole.mockImplementation((user: unknown) => user)
})

describe('GET /api/terminal/history', () => {
  it('rejects history access when the terminal is locked', async () => {
    sessionMock.getTerminalUnlockSession.mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/terminal/history?limit=5') as never)

    expect(response.status).toBe(403)
    expect(sessionMock.clearTerminalUnlockCookie).toHaveBeenCalled()
  })

  it('returns recent scan history for the unlocked enforcer session', async () => {
    sessionMock.getTerminalUnlockSession.mockResolvedValueOnce({ id: 'unlock-1' })
    sessionMock.touchTerminalUnlockSession.mockResolvedValueOnce({
      id: 'unlock-1',
      expiresAt: new Date('2026-04-12T10:30:00.000Z'),
    })
    sessionMock.getTerminalUnlockToken.mockReturnValueOnce('unlock-token')
    historyMock.listRecentTerminalScanHistory.mockResolvedValueOnce([
      {
        id: 'audit-1',
        scannedAt: '2026-04-12T10:00:00.000Z',
        submittedToken: 'qr-token-1',
        resultType: 'MATCHED',
        scanSource: 'CAMERA',
        disposition: 'CLEAR',
        matchedPermitId: 'permit-1',
        permitPlateNumber: 'PERM-100',
        vehiclePlateNumber: 'ABC-123',
      },
    ])

    const response = await GET(new Request('http://localhost/api/terminal/history?limit=5') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(historyMock.listRecentTerminalScanHistory).toHaveBeenCalledWith('enforcer-1', 5)
    expect(sessionMock.applyTerminalUnlockCookie).toHaveBeenCalled()
    expect(json.items).toHaveLength(1)
    expect(json.items[0].vehiclePlateNumber).toBe('ABC-123')
  })
})