import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  permit: {
    findMany: vi.fn(),
  },
}))

const permitQrMock = vi.hoisted(() => ({
  markPermitQrPrinted: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/permits/qr', () => permitQrMock)

vi.mock('@/lib/serializers', () => ({
  serializePermit: vi.fn((permit: Record<string, unknown>) => ({ ...permit, serialized: true })),
}))

import { POST } from '@/app/api/permits/qr-print/route'

function postRequest(body: unknown) {
  return new Request('http://localhost/api/permits/qr-print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'encoder-1', userType: 'DATA_ENCODER' })
})

describe('POST /api/permits/qr-print', () => {
  it('rejects callers outside ADMIN_OR_ENCODER', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await POST(postRequest({ permitIds: ['permit-1'] }))

    expect(response.status).toBe(403)
    expect(permitQrMock.markPermitQrPrinted).not.toHaveBeenCalled()
  })

  it('rejects an empty permit list', async () => {
    const response = await POST(postRequest({ permitIds: [] }))

    expect(response.status).toBe(400)
    expect(permitQrMock.markPermitQrPrinted).not.toHaveBeenCalled()
  })

  it('rejects a non-array body', async () => {
    const response = await POST(postRequest({ permitIds: 'permit-1' }))

    expect(response.status).toBe(400)
  })

  it('rejects a batch over the 200 permit cap', async () => {
    const permitIds = Array.from({ length: 201 }, (_, index) => `permit-${index}`)

    const response = await POST(postRequest({ permitIds }))

    expect(response.status).toBe(400)
    expect(permitQrMock.markPermitQrPrinted).not.toHaveBeenCalled()
  })

  it('marks the batch printed and returns the refreshed permits', async () => {
    permitQrMock.markPermitQrPrinted.mockResolvedValueOnce({
      markedIds: ['permit-1'],
      skippedIds: ['permit-2'],
    })
    prismaMock.permit.findMany.mockResolvedValueOnce([
      { id: 'permit-1', permitPlateNumber: 'PERM-100' },
    ])

    const response = await POST(postRequest({ permitIds: ['permit-1', 'permit-2', 'permit-1'] }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    // Duplicate ids collapse before reaching the service.
    expect(permitQrMock.markPermitQrPrinted).toHaveBeenCalledWith({
      permitIds: ['permit-1', 'permit-2'],
      printedBy: 'encoder-1',
    })
    expect(payload.markedCount).toBe(1)
    expect(payload.skippedCount).toBe(1)
    expect(payload.permits).toHaveLength(1)
  })

  it('skips the permit re-read when nothing was marked', async () => {
    permitQrMock.markPermitQrPrinted.mockResolvedValueOnce({ markedIds: [], skippedIds: ['permit-1'] })

    const response = await POST(postRequest({ permitIds: ['permit-1'] }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.permit.findMany).not.toHaveBeenCalled()
    expect(payload.permits).toEqual([])
  })
})
