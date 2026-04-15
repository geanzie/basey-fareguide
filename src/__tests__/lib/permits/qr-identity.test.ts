import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  permit: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { lookupPublicRideTagToken } from '@/lib/permits/qrIdentity'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('lookupPublicRideTagToken', () => {
  it('returns a public-safe not-found payload for missing tokens', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce(null)

    const result = await lookupPublicRideTagToken('missing-token')

    expect(result).toEqual({
      scannedToken: 'missing-token',
      matchFound: false,
      permitStatus: null,
      permit: null,
      vehicle: null,
      message: 'No permit matched the submitted QR token.',
    })
  })

  it('returns public-safe permit and vehicle identity without enforcer-only fields', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'BP-1001',
      qrToken: 'qr-token-1',
      qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Name',
      vehicleType: 'TRICYCLE',
      issuedDate: new Date('2026-01-01T00:00:00.000Z'),
      expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      vehicle: {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'TMX',
        color: 'Blue',
        ownerName: 'Owner Name',
        driverName: 'Driver Name',
        driverLicense: 'DL-1',
        registrationExpiry: new Date('2027-02-01T00:00:00.000Z'),
        insuranceExpiry: new Date('2027-02-01T00:00:00.000Z'),
        isActive: true,
      },
    })

    const result = await lookupPublicRideTagToken('qr-token-1')

    expect(result.matchFound).toBe(true)
    expect(result.permitStatus).toBe('ACTIVE')
    expect(result.vehicle).toEqual({
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      permitPlateNumber: 'BP-1001',
      vehicleType: 'TRICYCLE',
      make: 'Honda',
      model: 'TMX',
      color: 'Blue',
      driverName: 'Driver Name',
    })
    expect(result.vehicle).not.toHaveProperty('driverLicense')
    expect(result.vehicle).not.toHaveProperty('ownerName')
    expect(result).not.toHaveProperty('incidentHandoff')
  })
})