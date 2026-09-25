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
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENFORCER: ['ADMIN', 'ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/enforcer/operations/route'

function request(query = '') {
  return new Request(`http://localhost/api/enforcer/operations${query}`) as never
}

const incident = {
  id: 'inc-1',
  incidentType: 'FARE_OVERCHARGE',
  status: 'PENDING',
  location: 'Anglit',
  coordinates: JSON.stringify({ latitude: 11.3, longitude: 125.1 }),
  tripOrigin: null,
  plateNumber: null,
  vehicleType: null,
  incidentDate: new Date('2026-09-20T02:00:00.000Z'),
  createdAt: new Date('2026-09-20T02:05:00.000Z'),
  resolvedAt: null,
  dismissedAt: null,
  referredAt: null,
  vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE' },
}

describe('GET /api/enforcer/operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.requireRequestRole.mockResolvedValue({ id: 'enf-1', userType: 'ENFORCER' })
    prismaMock.incident.findMany.mockResolvedValue([incident])
    prismaMock.incident.count.mockResolvedValue(1)
    prismaMock.incident.findFirst.mockResolvedValue({ incidentDate: incident.incidentDate })
  })

  it('rejects roles other than admin and enforcer', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(authMock.requireRequestRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN', 'ENFORCER'])
  })

  it('rejects an unknown range with a message', async () => {
    const response = await GET(request('?range=1y'))
    expect(response.status).toBe(400)
    expect((await response.json()).message).toContain('Invalid range')
  })

  it('returns the dashboard payload uncached', async () => {
    const response = await GET(request('?range=30d'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.range).toBe('30d')
    expect(body.pulse.openCount).toBe(1)
    expect(body.pulse.oldestOpenAt).toBe('2026-09-20T02:00:00.000Z')
    expect(body.points[0]).toMatchObject({ id: 'inc-1', precision: 'GPS', plateNumber: 'ABC-123' })
    expect(body.feed[0]).toMatchObject({ typeLabel: 'Fare Overcharge', vehicleType: 'TRICYCLE' })
    expect(body.truncated).toBe(false)
    expect(body.previousPeriodCount).toBe(1)
    expect(body.records[0]).toMatchObject({ status: 'PENDING', vehicleType: 'TRICYCLE', closedAt: null })
  })
})
