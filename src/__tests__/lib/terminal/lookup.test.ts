import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  permit: {
    findUnique: vi.fn(),
  },
  incident: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  qrScanAudit: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { lookupQrToken } from '@/lib/terminal/lookup'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.incident.count.mockResolvedValue(0)
  prismaMock.incident.aggregate.mockResolvedValue({ _sum: { penaltyAmount: 0 } })
  prismaMock.incident.findMany.mockResolvedValue([])
})

describe('lookupQrToken', () => {
  it('returns NOT_FOUND when no permit matches the token', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce(null)

    const { result, audit } = await lookupQrToken('missing-token')

    expect(result.matchFound).toBe(false)
    expect(result.scanDisposition).toBe('NOT_FOUND')
    expect(audit.resultType).toBe('NOT_FOUND')
  })

  it('classifies active permits with current records as CLEAR and COMPLIANT', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'BP-1001',
      qrToken: 'qr-token-1',
      qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Name',
      issuedDate: new Date('2026-01-01T00:00:00.000Z'),
      expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      vehicleId: 'vehicle-1',
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

    const { result, audit } = await lookupQrToken('qr-token-1')

    expect(result.matchFound).toBe(true)
    expect(result.permitStatus).toBe('ACTIVE')
    expect(result.complianceStatus).toBe('COMPLIANT')
    expect(result.scanDisposition).toBe('CLEAR')
    expect(result.incidentHandoff?.scannedTokenFingerprint).toMatch(/^sha256:/)
    expect(result.incidentHandoff?.scannedTokenFingerprint).not.toBe('qr-token-1')
    expect(result.incidentHandoff?.scanDispositionAtScan).toBe('CLEAR')
    expect(result.incidentHandoff?.complianceChecklistAtScan).toHaveLength(6)
    expect(result.incidentHandoff?.operator.operatorIdStatus).toBe('UNAVAILABLE')
    expect(audit.resultType).toBe('MATCHED')
    expect(audit.disposition).toBe('CLEAR')
  })

  it('classifies revoked permits as BLOCKED and NON_COMPLIANT', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-2',
      permitPlateNumber: 'BP-2002',
      qrToken: 'qr-token-2',
      qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Name',
      issuedDate: new Date('2026-01-01T00:00:00.000Z'),
      expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'REVOKED',
      vehicleId: 'vehicle-2',
      vehicle: {
        id: 'vehicle-2',
        plateNumber: 'XYZ-789',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'TMX',
        color: 'Blue',
        ownerName: 'Owner Name',
        driverName: 'Driver Name',
        driverLicense: 'DL-2',
        registrationExpiry: new Date('2027-02-01T00:00:00.000Z'),
        insuranceExpiry: new Date('2027-02-01T00:00:00.000Z'),
        isActive: true,
      },
    })

    const { result, audit } = await lookupQrToken('qr-token-2')

    expect(result.permitStatus).toBe('REVOKED')
    expect(result.complianceStatus).toBe('NON_COMPLIANT')
    expect(result.scanDisposition).toBe('BLOCKED')
    expect(audit.disposition).toBe('BLOCKED')
  })

  it('invalidates rotated QR tokens immediately by matching only the current stored token', async () => {
    prismaMock.permit.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'permit-3',
        permitPlateNumber: 'BP-3003',
        qrToken: 'rotated-qr-token',
        qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
        qrIssuedBy: 'encoder-1',
        driverFullName: 'Driver Name',
        issuedDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2027-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
        vehicleId: 'vehicle-3',
        vehicle: {
          id: 'vehicle-3',
          plateNumber: 'ROT-333',
          vehicleType: 'TRICYCLE',
          make: 'Honda',
          model: 'TMX',
          color: 'Red',
          ownerName: 'Owner Name',
          driverName: 'Driver Name',
          driverLicense: 'DL-3',
          registrationExpiry: new Date('2027-02-01T00:00:00.000Z'),
          insuranceExpiry: new Date('2027-02-01T00:00:00.000Z'),
          isActive: true,
        },
      })

    const missingLookup = await lookupQrToken('old-qr-token')
    const currentLookup = await lookupQrToken('rotated-qr-token')

    expect(missingLookup.result.matchFound).toBe(false)
    expect(missingLookup.result.scanDisposition).toBe('NOT_FOUND')
    expect(currentLookup.result.matchFound).toBe(true)
    expect(currentLookup.result.permit?.qrToken).toBe('rotated-qr-token')
  })

  it('aggregates unresolved public-user reports through trip vehicle context and preserves penalty totals', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-public-1',
      permitPlateNumber: 'BP-4004',
      qrToken: 'qr-token-public-1',
      qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Public',
      issuedDate: new Date('2026-01-01T00:00:00.000Z'),
      expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      vehicleId: 'vehicle-public-1',
      vehicle: {
        id: 'vehicle-public-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'TMX',
        color: 'Blue',
        ownerName: 'Owner Name',
        driverName: 'Driver Public',
        driverLicense: 'DL-PUBLIC-1',
        registrationExpiry: new Date('2027-02-01T00:00:00.000Z'),
        insuranceExpiry: new Date('2027-02-01T00:00:00.000Z'),
        isActive: true,
      },
    })
    prismaMock.incident.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    prismaMock.incident.aggregate.mockResolvedValueOnce({
      _sum: { penaltyAmount: 500 },
    })
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: 'incident-public-1',
        incidentType: 'FARE_OVERCHARGE',
        status: 'PENDING',
        ticketNumber: null,
        paymentStatus: 'NOT_APPLICABLE',
        penaltyAmount: null,
        incidentDate: new Date('2026-04-12T08:00:00.000Z'),
      },
    ])

    const { result } = await lookupQrToken('qr-token-public-1')

    expect(prismaMock.incident.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { vehicleId: 'vehicle-public-1' },
          { plateNumber: { in: ['ABC-123'] } },
          { tripPlateNumber: { in: ['ABC-123'] } },
          { tripPermitPlateNumber: { in: ['BP-4004'] } },
          { driverLicense: 'DL-PUBLIC-1' },
        ],
      },
    })
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { vehicleId: 'vehicle-public-1' },
          { plateNumber: { in: ['ABC-123'] } },
          { tripPlateNumber: { in: ['ABC-123'] } },
          { tripPermitPlateNumber: { in: ['BP-4004'] } },
          { driverLicense: 'DL-PUBLIC-1' },
        ],
        status: { in: ['PENDING', 'INVESTIGATING'] },
      },
      orderBy: [{ incidentDate: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        incidentType: true,
        status: true,
        ticketNumber: true,
        paymentStatus: true,
        penaltyAmount: true,
        incidentDate: true,
      },
    })
    expect(result.violationSummary?.totalViolations).toBe(3)
    expect(result.violationSummary?.openIncidents).toBe(1)
    expect(result.violationSummary?.outstandingPenalties).toBe(500)
    expect(result.complianceStatus).toBe('NON_COMPLIANT')
  })

  it('includes operator-linked incidents through driver license when vehicle linkage is partial', async () => {
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-operator-1',
      permitPlateNumber: 'BP-5005',
      qrToken: 'qr-token-operator-1',
      qrIssuedAt: new Date('2026-04-12T08:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Operator',
      issuedDate: new Date('2026-01-01T00:00:00.000Z'),
      expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      vehicleId: 'vehicle-operator-1',
      vehicle: {
        id: 'vehicle-operator-1',
        plateNumber: 'XYZ-789',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'TMX',
        color: 'Red',
        ownerName: 'Owner Name',
        driverName: 'Driver Operator',
        driverLicense: 'DL-OP-1',
        registrationExpiry: new Date('2027-02-01T00:00:00.000Z'),
        insuranceExpiry: new Date('2027-02-01T00:00:00.000Z'),
        isActive: true,
      },
    })
    prismaMock.incident.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
    prismaMock.incident.aggregate.mockResolvedValueOnce({
      _sum: { penaltyAmount: 0 },
    })
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: 'incident-operator-1',
        incidentType: 'RECKLESS_DRIVING',
        status: 'INVESTIGATING',
        ticketNumber: null,
        paymentStatus: 'NOT_APPLICABLE',
        penaltyAmount: null,
        incidentDate: new Date('2026-04-13T08:00:00.000Z'),
      },
    ])

    const { result } = await lookupQrToken('qr-token-operator-1')

    expect(prismaMock.incident.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { vehicleId: 'vehicle-operator-1' },
          { plateNumber: { in: ['XYZ-789'] } },
          { tripPlateNumber: { in: ['XYZ-789'] } },
          { tripPermitPlateNumber: { in: ['BP-5005'] } },
          { driverLicense: 'DL-OP-1' },
        ],
      },
    })
    expect(result.violationSummary?.totalViolations).toBe(1)
    expect(result.violationSummary?.openIncidents).toBe(1)
    expect(result.violationSummary?.outstandingPenalties).toBe(0)
    expect(result.permitStatus).toBe('ACTIVE')
  })
})