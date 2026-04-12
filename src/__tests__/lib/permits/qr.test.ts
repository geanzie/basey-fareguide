import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  permit: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  permitQrAudit: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      permit: prismaMock.permit,
      permitQrAudit: prismaMock.permitQrAudit,
    }),
  ),
}))

const qrTokenMock = vi.hoisted(() => ({
  generateQrToken: vi.fn(),
  fingerprintQrToken: vi.fn((token: string) => `fp:${token}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/permits/qrToken', () => qrTokenMock)

import { createPermitWithQr, issuePermitQrToken } from '@/lib/permits/qr'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('permit QR service', () => {
  it('creates a QR audit entry when a permit is created with its first QR token', async () => {
    qrTokenMock.generateQrToken.mockReturnValueOnce('issued-qr-token')
    prismaMock.permit.create.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-100',
      qrToken: 'issued-qr-token',
      qrIssuedAt: new Date('2026-04-12T09:00:00.000Z'),
      qrIssuedBy: 'encoder-1',
      driverFullName: 'Driver Name',
      vehicleType: 'TRICYCLE',
      issuedDate: new Date('2026-04-12T09:00:00.000Z'),
      expiryDate: new Date('2027-04-12T09:00:00.000Z'),
      status: 'ACTIVE',
      remarks: null,
      encodedBy: 'encoder-1',
      encodedAt: new Date('2026-04-12T09:00:00.000Z'),
      lastUpdatedBy: null,
      lastUpdatedAt: null,
      renewalHistory: [],
      vehicle: null,
    })
    prismaMock.permitQrAudit.create.mockResolvedValueOnce({ id: 'audit-1' })

    await createPermitWithQr({
      vehicleId: 'vehicle-1',
      permitPlateNumber: 'perm-100',
      driverFullName: 'Driver Name',
      vehicleType: 'TRICYCLE',
      encodedBy: 'encoder-1',
      remarks: null,
    })

    expect(prismaMock.permitQrAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitId: 'permit-1',
          permitPlateNumber: 'PERM-100',
          action: 'ISSUE_QR',
          actedBy: 'encoder-1',
          previousTokenFingerprint: null,
          currentTokenFingerprint: 'fp:issued-qr-token',
        }),
      }),
    )
  })

  it('records rotation audits with previous and current token fingerprints', async () => {
    qrTokenMock.generateQrToken.mockReturnValueOnce('rotated-qr-token')
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-100',
      qrToken: 'old-qr-token',
    })
    prismaMock.permit.update.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-100',
      qrToken: 'rotated-qr-token',
      qrIssuedAt: new Date('2026-04-12T09:00:00.000Z'),
      qrIssuedBy: 'encoder-2',
      driverFullName: 'Driver Name',
      vehicleType: 'TRICYCLE',
      issuedDate: new Date('2026-04-12T09:00:00.000Z'),
      expiryDate: new Date('2027-04-12T09:00:00.000Z'),
      status: 'ACTIVE',
      remarks: null,
      encodedBy: 'encoder-1',
      encodedAt: new Date('2026-04-12T09:00:00.000Z'),
      lastUpdatedBy: null,
      lastUpdatedAt: null,
      renewalHistory: [],
      vehicle: null,
    })
    prismaMock.permitQrAudit.create.mockResolvedValueOnce({ id: 'audit-2' })

    await issuePermitQrToken({
      permitId: 'permit-1',
      issuedBy: 'encoder-2',
    })

    expect(prismaMock.permitQrAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitId: 'permit-1',
          permitPlateNumber: 'PERM-100',
          action: 'ROTATE_QR',
          actedBy: 'encoder-2',
          previousTokenFingerprint: 'fp:old-qr-token',
          currentTokenFingerprint: 'fp:rotated-qr-token',
        }),
      }),
    )
  })
})