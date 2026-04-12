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

const terminalLookupMock = vi.hoisted(() => ({
  lookupQrToken: vi.fn(),
  writeQrScanAudit: vi.fn(),
}))

const sessionMock = vi.hoisted(() => ({
  getTerminalUnlockSession: vi.fn(),
  touchTerminalUnlockSession: vi.fn(),
  applyTerminalUnlockCookie: vi.fn(),
  clearTerminalUnlockCookie: vi.fn(),
  getTerminalUnlockToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/terminal/lookup', () => terminalLookupMock)
vi.mock('@/lib/terminal/session', () => sessionMock)

import { POST } from '@/app/api/terminal/lookup/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuth.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  authMock.requireRole.mockImplementation((user: unknown) => user)
})

describe('POST /api/terminal/lookup', () => {
  it('audits unauthorized scan attempts when the terminal lock is missing', async () => {
    sessionMock.getTerminalUnlockSession.mockResolvedValueOnce(null)

    const response = await POST(
      new Request('http://localhost/api/terminal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'qr-token-1', scanSource: 'MANUAL' }),
      }) as never,
    )

    expect(response.status).toBe(403)
    expect(terminalLookupMock.writeQrScanAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        scannerUserId: 'enforcer-1',
        submittedToken: 'qr-token-1',
        resultType: 'UNAUTHORIZED',
        scanSource: 'MANUAL',
      }),
    )
  })

  it('returns the terminal lookup payload and audits matched scans', async () => {
    sessionMock.getTerminalUnlockSession.mockResolvedValueOnce({ id: 'unlock-1' })
    sessionMock.touchTerminalUnlockSession.mockResolvedValueOnce({
      id: 'unlock-1',
      expiresAt: new Date('2026-04-12T09:15:00.000Z'),
    })
    sessionMock.getTerminalUnlockToken.mockReturnValueOnce('unlock-token')
    terminalLookupMock.lookupQrToken.mockResolvedValueOnce({
      result: {
        scannedToken: 'qr-token-1',
        matchFound: true,
        permitStatus: 'ACTIVE',
        complianceStatus: 'COMPLIANT',
        scanDisposition: 'CLEAR',
        permit: { id: 'permit-1' },
        vehicle: { id: 'vehicle-1', plateNumber: 'ABC-123' },
        operator: null,
        complianceChecklist: [],
        violationSummary: null,
        incidentHandoff: null,
        message: 'Permit is clear for compliance validation.',
      },
      audit: {
        matchedPermitId: 'permit-1',
        resultType: 'MATCHED',
        disposition: 'CLEAR',
      },
    })

    const response = await POST(
      new Request('http://localhost/api/terminal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'qr-token-1', scanSource: 'CAMERA' }),
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(terminalLookupMock.lookupQrToken).toHaveBeenCalledWith('qr-token-1')
    expect(terminalLookupMock.writeQrScanAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        scannerUserId: 'enforcer-1',
        submittedToken: 'qr-token-1',
        matchedPermitId: 'permit-1',
        resultType: 'MATCHED',
        scanSource: 'CAMERA',
        disposition: 'CLEAR',
      }),
    )
    expect(sessionMock.applyTerminalUnlockCookie).toHaveBeenCalled()
    expect(json.scanDisposition).toBe('CLEAR')
  })
})