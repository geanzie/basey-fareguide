import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { penaltyAmount: null } }),
    groupBy: vi.fn().mockResolvedValue([]),
  })
  return {
    vehicle: model(),
    permit: model(),
    permitRenewal: model(),
    permitQrAudit: model(),
    incident: model(),
  }
})

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/encoder/operations/route'

function request(query = '') {
  return new Request(`http://localhost/api/encoder/operations${query}`) as never
}

/** Prisma's Decimal as the route sees it: an object with toString. */
const decimal = (value: string) => ({ toString: () => value })

const paidTicket = {
  id: 'inc-1',
  ticketNumber: 'T-001',
  penaltyAmount: decimal('500.00'),
  ticketIssuedAt: new Date('2026-09-18T02:00:00.000Z'),
  paidAt: new Date('2026-09-20T00:00:00.000Z'),
  paymentRecordedAt: new Date('2026-09-20T03:00:00.000Z'),
  plateNumber: null,
  vehicleType: null,
  vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE' },
}

const unpaidTicket = {
  ...paidTicket,
  id: 'inc-2',
  ticketNumber: 'T-002',
  penaltyAmount: decimal('1000'),
  paidAt: null,
  paymentRecordedAt: null,
}

describe('GET /api/encoder/operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.requireRequestRole.mockResolvedValue({ id: 'enc-1', userType: 'DATA_ENCODER' })
    for (const model of Object.values(prismaMock)) {
      model.findMany.mockResolvedValue([])
      model.count.mockResolvedValue(0)
      model.aggregate.mockResolvedValue({ _sum: { penaltyAmount: null } })
      model.groupBy.mockResolvedValue([])
    }
  })

  it('rejects roles other than admin and encoder', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(authMock.requireRequestRole).toHaveBeenCalledWith(expect.anything(), ['ADMIN', 'DATA_ENCODER'])
  })

  it('rejects an unknown range with a message', async () => {
    const response = await GET(request('?range=1y'))
    expect(response.status).toBe(400)
    expect((await response.json()).message).toContain('Invalid range')
  })

  it('returns an empty dashboard uncached', async () => {
    const response = await GET(request('?range=30d'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.range).toBe('30d')
    expect(body.events).toEqual([])
    expect(body.queue).toEqual([])
    expect(body.pulse.unpaidAmount).toBe(0)
    expect(body.pulse.oldestUnpaidAt).toBeNull()
    expect(body.truncated).toBe(false)
  })

  it('turns payments into events with pesos and days to pay', async () => {
    prismaMock.incident.findMany.mockImplementation(async (args: { where: { paymentStatus?: string } }) =>
      args.where.paymentStatus === 'PAID' ? [paidTicket] : [unpaidTicket],
    )
    prismaMock.incident.count.mockResolvedValue(1)
    prismaMock.incident.aggregate.mockResolvedValue({ _sum: { penaltyAmount: decimal('1000') } })

    const body = await (await GET(request())).json()

    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      id: 'PAYMENT_RECORDED:inc-1',
      at: '2026-09-20T03:00:00.000Z',
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      amount: 500,
    })
    expect(body.events[0].lagDays).toBeCloseTo(46 / 24)
    expect(body.feed).toEqual(body.events)

    expect(body.pulse.unpaidTicketCount).toBe(1)
    expect(body.pulse.unpaidAmount).toBe(1000)
    expect(body.pulse.oldestUnpaidAt).toBe('2026-09-18T02:00:00.000Z')
    expect(body.queue).toContainEqual(
      expect.objectContaining({
        id: 'UNPAID_TICKET:inc-2',
        amount: 1000,
        reference: 'T-002',
        href: '/encoder/ticket-payments',
      }),
    )
  })

  it('merges every desk source newest first, and maps the permit snapshot', async () => {
    prismaMock.vehicle.findMany.mockImplementation(async (args: { where: { createdAt?: unknown } }) =>
      args.where.createdAt
        ? [{ id: 'v1', plateNumber: 'V-1', vehicleType: 'TRICYCLE', createdAt: new Date('2026-09-20T01:00:00.000Z') }]
        : [],
    )
    prismaMock.permitQrAudit.findMany.mockResolvedValue([
      {
        id: 'a1',
        action: 'PRINT_QR',
        actedAt: new Date('2026-09-21T01:00:00.000Z'),
        permitPlateNumber: 'P-1',
        permit: { vehicleType: 'HABAL_HABAL' },
      },
    ])
    prismaMock.permit.groupBy.mockResolvedValue([{ vehicleType: 'TRICYCLE', status: 'ACTIVE', _count: { _all: 4 } }])

    const body = await (await GET(request())).json()

    expect(body.events.map((event: { id: string }) => event.id)).toEqual(['QR_PRINTED:a1', 'VEHICLE_REGISTERED:v1'])
    expect(body.permitSnapshot).toEqual([{ vehicleType: 'TRICYCLE', status: 'ACTIVE', count: 4 }])
  })

  it('flags truncation when a source holds more rows than it reads', async () => {
    const rows = Array.from({ length: 5001 }, (_, index) => ({
      id: `v${index}`,
      plateNumber: `V-${index}`,
      vehicleType: 'TRICYCLE',
      createdAt: new Date('2026-09-20T01:00:00.000Z'),
    }))
    prismaMock.vehicle.findMany.mockImplementation(async (args: { where: { createdAt?: unknown } }) =>
      args.where.createdAt ? rows : [],
    )
    const body = await (await GET(request())).json()
    expect(body.truncated).toBe(true)
    expect(body.events).toHaveLength(5000)
  })
})
