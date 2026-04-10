import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  discountCard: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/admin/discount-cards/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  prismaMock.discountCard.findMany.mockResolvedValue([
    {
      id: 'card-1',
      fullName: 'Ana Santos',
      isActive: true,
      isAdminOverride: false,
      verificationStatus: 'APPROVED',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      user: {
        id: 'user-1',
        username: 'ana',
        firstName: 'Ana',
        lastName: 'Santos',
        phoneNumber: null,
        barangayResidence: null,
      },
    },
  ])
  prismaMock.discountCard.count.mockResolvedValue(240)
})

describe('GET /api/admin/discount-cards', () => {
  it('caps oversized limits and keeps the existing pagination contract', async () => {
    const res = await GET(
      new Request('http://localhost/api/admin/discount-cards?page=3&limit=500&search=ana&isActive=true') as never,
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.pagination).toEqual({
      page: 3,
      limit: 100,
      totalCount: 240,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    })
    expect(prismaMock.discountCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 200,
        take: 100,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })
})