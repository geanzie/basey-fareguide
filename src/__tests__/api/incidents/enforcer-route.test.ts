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
  },
}))

const serializersMock = vi.hoisted(() => ({
  serializeIncident: vi.fn((incident: Record<string, unknown>) => incident),
}))

vi.mock('@/lib/auth', () => ({
  ENFORCER_ONLY: ['ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializeIncident: serializersMock.serializeIncident,
}))

import { GET } from '@/app/api/incidents/enforcer/route'

function makeIncident(status: 'PENDING' | 'TICKET_ISSUED' | 'RESOLVED' | 'DISMISSED') {
  return {
    id: `incident-${status.toLowerCase()}`,
    incidentType: 'OTHER',
    description: `${status} incident`,
    location: 'Basey',
    plateNumber: 'ABC-123',
    driverLicense: 'D-1234',
    vehicleType: 'TRICYCLE',
    incidentDate: new Date('2026-04-01T10:00:00.000Z'),
    status,
    ticketNumber: status === 'RESOLVED' ? 'T-100' : null,
    paymentStatus: status === 'RESOLVED' ? 'PAID' : null,
    paidAt: status === 'RESOLVED' ? new Date('2026-04-02T09:00:00.000Z') : null,
    officialReceiptNumber: null,
    penaltyAmount: status === 'RESOLVED' ? 500 : null,
    remarks: null,
    createdAt: new Date('2026-04-01T10:05:00.000Z'),
    updatedAt: new Date('2026-04-01T10:10:00.000Z'),
    reportedBy: null,
    handledBy: null,
    vehicle: null,
    evidence: [],
  }
}

function makeRequest(url: string) {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  prismaMock.incident.findMany.mockResolvedValue([makeIncident('PENDING')])
})

describe('GET /api/incidents/enforcer', () => {
  it('defaults to the dashboard all-scope ordering when scope is omitted', async () => {
    const response = await GET(makeRequest('http://localhost/api/incidents/enforcer') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRequestRole).toHaveBeenCalledWith(expect.any(Request), ['ENFORCER'])
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
      }),
    )
    expect(json.filters).toEqual(
      expect.objectContaining({
        scope: 'all',
        violationType: 'all',
      }),
    )
  })

  it('returns unresolved queue data with FIFO ordering when unresolved scope is requested', async () => {
    prismaMock.incident.findMany.mockResolvedValueOnce([
      makeIncident('PENDING'),
      makeIncident('TICKET_ISSUED'),
    ])

    const response = await GET(
      makeRequest('http://localhost/api/incidents/enforcer?scope=unresolved') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['PENDING', 'TICKET_ISSUED'] },
        },
        orderBy: { createdAt: 'asc' },
      }),
    )
    expect(json.filters).toEqual(
      expect.objectContaining({
        scope: 'unresolved',
      }),
    )
    expect(json.incidents).toHaveLength(2)
  })

  it('rejects explicit invalid scope values with 400', async () => {
    const response = await GET(
      makeRequest('http://localhost/api/incidents/enforcer?scope=banana') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toContain('Invalid scope "banana"')
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled()
  })

  it('keeps terminal incidents available to dashboard scope', async () => {
    prismaMock.incident.findMany.mockResolvedValueOnce([
      makeIncident('PENDING'),
      makeIncident('RESOLVED'),
      makeIncident('DISMISSED'),
    ])

    const response = await GET(
      makeRequest('http://localhost/api/incidents/enforcer?scope=all') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.incidents.map((incident: { status: string }) => incident.status)).toEqual([
      'PENDING',
      'RESOLVED',
      'DISMISSED',
    ])
  })
})
