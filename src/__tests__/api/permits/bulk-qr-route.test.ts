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
    count: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/serializers', () => ({
  serializePermit: vi.fn((permit: Record<string, unknown>) => ({ ...permit, serialized: true })),
}))

import { GET } from '@/app/api/permits/bulk-qr/route'

function getRequest(query = '') {
  return new Request(`http://localhost/api/permits/bulk-qr${query}`) as unknown as Parameters<
    typeof GET
  >[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'encoder-1', userType: 'DATA_ENCODER' })
  prismaMock.permit.count.mockResolvedValue(0)
  prismaMock.permit.findMany.mockResolvedValue([])
})

describe('GET /api/permits/bulk-qr', () => {
  it('defaults to the unprinted queue', async () => {
    const response = await GET(getRequest())
    const payload = await response.json()

    expect(payload.scope).toBe('unprinted')
    expect(prismaMock.permit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ qrPrintedAt: null, status: 'ACTIVE' }),
      }),
    )
  })

  it('returns every QR-issued permit under scope=all', async () => {
    const response = await GET(getRequest('?scope=all'))
    const payload = await response.json()

    expect(payload.scope).toBe('all')
    const where = prismaMock.permit.findMany.mock.calls[0][0].where
    expect(where).not.toHaveProperty('qrPrintedAt')
    expect(where).not.toHaveProperty('id')
  })

  it('lets an explicit id list override the queue filter', async () => {
    await GET(getRequest('?ids=permit-1,permit-2,permit-1'))

    const where = prismaMock.permit.findMany.mock.calls[0][0].where
    expect(where.id).toEqual({ in: ['permit-1', 'permit-2'] })
    expect(where).not.toHaveProperty('qrPrintedAt')
  })

  it('caps the id list at 200 entries', async () => {
    const ids = Array.from({ length: 250 }, (_, index) => `permit-${index}`).join(',')

    await GET(getRequest(`?ids=${ids}`))

    const where = prismaMock.permit.findMany.mock.calls[0][0].where
    expect(where.id.in).toHaveLength(200)
  })

  it('answers countOnly=1 without loading permits or their tokens', async () => {
    prismaMock.permit.count.mockResolvedValueOnce(240)

    const response = await GET(getRequest('?scope=unprinted&countOnly=1'))
    const payload = await response.json()

    expect(payload).toEqual({ permits: [], total: 240, truncated: true, scope: 'unprinted' })
    expect(prismaMock.permit.findMany).not.toHaveBeenCalled()
  })

  it('rejects callers outside ADMIN_OR_ENCODER', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await GET(getRequest())

    expect(response.status).toBe(403)
    expect(prismaMock.permit.findMany).not.toHaveBeenCalled()
  })
})
