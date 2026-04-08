import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ message }), { status: 500 })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  incident: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ENFORCER_ONLY: ['ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { POST as createTicket } from '@/app/api/tickets/route'

function makeJsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
  prismaMock.vehicle.findUnique.mockResolvedValue(null)
  prismaMock.vehicle.create.mockResolvedValue({ id: 'vehicle-1' })
  prismaMock.incident.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'incident-1',
    ...data,
  }))
})

describe('ticket creation payment state', () => {
  it('creates ticketed incidents as unpaid even when requiresPayment is false', async () => {
    const response = await createTicket(
      makeJsonRequest({
        incidentType: 'FARE_OVERCHARGE',
        description: 'Fare mismatch',
        location: 'Amandayehan',
        plateNumber: 'ABC-123',
        penaltyAmount: 500,
        requiresPayment: false,
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('Ticket issued successfully')
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'UNPAID',
          paidAt: null,
        }),
      }),
    )
  })

  it('keeps explicitly paid tickets marked as paid', async () => {
    await createTicket(
      makeJsonRequest({
        incidentType: 'RECKLESS_DRIVING',
        description: 'Reckless driving observed',
        location: 'San Antonio',
        plateNumber: 'ABC-123',
        penaltyAmount: 500,
        paymentStatus: 'PAID',
      }) as never,
    )

    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PAID',
        }),
      }),
    )
  })
})