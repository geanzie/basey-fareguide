import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500

    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

const serializersMock = vi.hoisted(() => ({
  serializeDashboardActivityItem: vi.fn((incident: {
    id: string
    incidentType: string
    description: string
    location: string
    status: string
    createdAt: Date | string
    ticketNumber?: string | null
  }) => ({
    id: incident.id,
    type: incident.incidentType,
    description: incident.description,
    location: incident.location,
    status: incident.status,
    createdAt:
      incident.createdAt instanceof Date
        ? incident.createdAt.toISOString()
        : String(incident.createdAt),
    ticketNumber: incident.ticketNumber ?? null,
  })),
}))

vi.mock('@/lib/auth', () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializeDashboardActivityItem: serializersMock.serializeDashboardActivityItem,
}))

import { GET } from '@/app/api/dashboard/activity/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestUser.mockResolvedValue({ id: 'user-1', userType: 'ADMIN' })
  prismaMock.incident.findMany.mockResolvedValue([
    {
      id: 'incident-1',
      incidentType: 'FARE_OVERCHARGE',
      description: 'Collected more than the posted fare',
      location: 'Basey Terminal',
      status: 'PENDING',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      ticketNumber: 'T-001',
      reportedBy: { firstName: 'Ana', lastName: 'Santos' },
      handledBy: null,
    },
  ])
  prismaMock.incident.count.mockResolvedValue(125)
})

describe('GET /api/dashboard/activity', () => {
  it('caps oversized activity requests and returns pagination metadata', async () => {
    const res = await GET(new Request('http://localhost/api/dashboard/activity?page=2&limit=999') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.activity).toHaveLength(1)
    expect(json.pagination).toEqual({
      page: 2,
      limit: 50,
      total: 125,
      totalPages: 3,
    })
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })
})