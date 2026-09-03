import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  permit: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
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

import { createPermitWithQr, issuePermitQrToken, markPermitQrPrinted } from '@/lib/permits/qr'

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

  it('clears the print state when a token is rotated', async () => {
    qrTokenMock.generateQrToken.mockReturnValueOnce('rotated-qr-token')
    prismaMock.permit.findUnique.mockResolvedValueOnce({
      id: 'permit-1',
      permitPlateNumber: 'PERM-100',
      qrToken: 'old-qr-token',
    })
    prismaMock.permit.update.mockResolvedValueOnce({ id: 'permit-1' })
    prismaMock.permitQrAudit.create.mockResolvedValueOnce({ id: 'audit-3' })

    await issuePermitQrToken({ permitId: 'permit-1', issuedBy: 'encoder-2' })

    expect(prismaMock.permit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qrToken: 'rotated-qr-token',
          qrPrintedAt: null,
          qrPrintedBy: null,
        }),
      }),
    )
  })

  it('marks printed permits and writes one PRINT_QR audit row each', async () => {
    prismaMock.permit.findMany.mockResolvedValueOnce([
      { id: 'permit-1', permitPlateNumber: 'PERM-100', qrToken: 'token-1' },
      { id: 'permit-2', permitPlateNumber: 'PERM-200', qrToken: 'token-2' },
    ])
    prismaMock.permit.updateMany.mockResolvedValueOnce({ count: 2 })
    prismaMock.permitQrAudit.create.mockResolvedValue({ id: 'audit-print' })

    const result = await markPermitQrPrinted({
      permitIds: ['permit-1', 'permit-2', 'permit-1'],
      printedBy: 'encoder-3',
    })

    expect(result.markedIds).toEqual(['permit-1', 'permit-2'])
    expect(result.skippedIds).toEqual([])
    expect(prismaMock.permit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['permit-1', 'permit-2'] } },
        data: expect.objectContaining({ qrPrintedBy: 'encoder-3' }),
      }),
    )
    expect(prismaMock.permitQrAudit.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.permitQrAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          permitId: 'permit-1',
          action: 'PRINT_QR',
          actedBy: 'encoder-3',
          previousTokenFingerprint: null,
          currentTokenFingerprint: 'fp:token-1',
        }),
      }),
    )
  })

  it('skips permits without a QR token instead of marking them printed', async () => {
    prismaMock.permit.findMany.mockResolvedValueOnce([
      { id: 'permit-1', permitPlateNumber: 'PERM-100', qrToken: null },
    ])

    const result = await markPermitQrPrinted({
      permitIds: ['permit-1'],
      printedBy: 'encoder-3',
    })

    expect(result).toEqual({ markedIds: [], skippedIds: ['permit-1'] })
    expect(prismaMock.permit.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.permitQrAudit.create).not.toHaveBeenCalled()
  })
})
