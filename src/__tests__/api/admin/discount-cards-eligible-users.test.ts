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
  user: {
    findMany: vi.fn(),
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

import { GET } from '@/app/api/admin/discount-cards/create/route'

function request(query = '') {
  return new Request(`http://localhost/api/admin/discount-cards/create${query}`) as never
}

function users(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `user-${index}`,
    username: `user${index}`,
    firstName: 'Juan',
    lastName: `Dela Cruz ${index}`,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
})

describe('GET /api/admin/discount-cards/create', () => {
  it('returns one bounded page instead of every public user', async () => {
    prismaMock.user.findMany.mockResolvedValue(users(51))

    const response = await GET(request())
    const json = await response.json()

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }))
    expect(json.eligibleUsers).toHaveLength(50)
    expect(json.hasMore).toBe(true)
    expect(json.count).toBe(50)
  })

  it('reports no more rows when the page is not full', async () => {
    prismaMock.user.findMany.mockResolvedValue(users(3))

    const json = await (await GET(request())).json()

    expect(json.eligibleUsers).toHaveLength(3)
    expect(json.hasMore).toBe(false)
  })

  it('searches in the database, every word matching some field', async () => {
    prismaMock.user.findMany.mockResolvedValue([])

    await GET(request('?q=%20juan%20%20cruz%20'))

    const fields = (term: string) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { barangayResidence: { contains: term, mode: 'insensitive' } },
      ],
    })
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          discountCard: null,
          userType: 'PUBLIC',
          AND: [fields('juan'), fields('cruz')],
        },
      }),
    )
  })

  it('rejects non-admins', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })
})
