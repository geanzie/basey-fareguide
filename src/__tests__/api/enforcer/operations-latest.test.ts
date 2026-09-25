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
  incident: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENFORCER: ['ADMIN', 'ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/enforcer/operations/latest/route'

function request() {
  return new Request('http://localhost/api/enforcer/operations/latest') as never
}

describe('GET /api/enforcer/operations/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.requireRequestRole.mockResolvedValue({ id: 'enf-1', userType: 'ENFORCER' })
  })

  it('rejects roles other than admin and enforcer', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(authMock.requireRequestRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN', 'ENFORCER'])
    expect(prismaMock.incident.findFirst).not.toHaveBeenCalled()
  })

  it('returns the newest reported incident as the watermark', async () => {
    prismaMock.incident.findFirst.mockResolvedValue({
      id: 'inc-9',
      createdAt: new Date('2026-09-20T02:05:00.000Z'),
    })

    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.latestId).toBe('inc-9')
    expect(body.latestCreatedAt).toBe('2026-09-20T02:05:00.000Z')
    expect(typeof body.checkedAt).toBe('string')
    expect(prismaMock.incident.findFirst).toHaveBeenCalledWith({
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  })

  it('returns nulls when no incident has been reported', async () => {
    prismaMock.incident.findFirst.mockResolvedValue(null)
    const body = await (await GET(request())).json()
    expect(body.latestId).toBeNull()
    expect(body.latestCreatedAt).toBeNull()
  })
})
