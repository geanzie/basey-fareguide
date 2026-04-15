import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const rideTagMock = vi.hoisted(() => ({
  lookupPublicRideTagToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/permits/qrIdentity', () => ({
  lookupPublicRideTagToken: rideTagMock.lookupPublicRideTagToken,
}))

import { POST } from '@/app/api/public/ride-tag/lookup/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestUser.mockResolvedValue({ id: 'public-1', userType: 'PUBLIC' })
})

describe('POST /api/public/ride-tag/lookup', () => {
  it('requires a token', async () => {
    const response = await POST(
      new Request('http://localhost/api/public/ride-tag/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('QR token is required.')
    expect(rideTagMock.lookupPublicRideTagToken).not.toHaveBeenCalled()
  })

  it('returns the public-safe lookup payload for authenticated riders', async () => {
    rideTagMock.lookupPublicRideTagToken.mockResolvedValueOnce({
      scannedToken: 'qr-token-1',
      matchFound: true,
      permitStatus: 'ACTIVE',
      permit: {
        id: 'permit-1',
        permitPlateNumber: 'BP-1001',
        driverFullName: 'Driver Name',
        vehicleType: 'TRICYCLE',
        issuedDate: '2026-01-01T00:00:00.000Z',
        expiryDate: '2027-01-01T00:00:00.000Z',
        qrIssuedAt: '2026-04-12T08:00:00.000Z',
      },
      vehicle: {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        permitPlateNumber: 'BP-1001',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'TMX',
        color: 'Blue',
        driverName: 'Driver Name',
      },
      message: 'Vehicle identity confirmed. Review it and confirm before saving this trip.',
    })

    const response = await POST(
      new Request('http://localhost/api/public/ride-tag/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'qr-token-1' }),
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRequestUser).toHaveBeenCalled()
    expect(rideTagMock.lookupPublicRideTagToken).toHaveBeenCalledWith('qr-token-1')
    expect(json).not.toHaveProperty('incidentHandoff')
    expect(json).not.toHaveProperty('complianceChecklist')
    expect(json).not.toHaveProperty('violationSummary')
    expect(json.vehicle.plateNumber).toBe('ABC-123')
  })
})