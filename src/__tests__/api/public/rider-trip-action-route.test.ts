import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const driverSessionMock = vi.hoisted(() => ({
  applyRiderTripAction: vi.fn(),
}))

class FakeDriverSessionError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

vi.mock('@/lib/auth', () => ({
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/driverSession', () => ({
  applyRiderTripAction: driverSessionMock.applyRiderTripAction,
  isDriverSessionError: (error: unknown) => error instanceof FakeDriverSessionError,
}))

import { POST } from '@/app/api/public/trips/[sessionRiderId]/action/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/public/trips/rider-entry-1/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

const params = { params: Promise.resolve({ sessionRiderId: 'rider-entry-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'rider-1', userType: 'PUBLIC' })
})

describe('POST /api/public/trips/[sessionRiderId]/action', () => {
  it('completes a rider-confirmed trip', async () => {
    driverSessionMock.applyRiderTripAction.mockResolvedValue({
      status: 'COMPLETED',
      message: 'Dropped off saved.',
    })

    const response = await POST(makeRequest({ action: 'DROPPED_OFF' }), params)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ success: true, status: 'COMPLETED' })
    expect(driverSessionMock.applyRiderTripAction).toHaveBeenCalledWith(
      'rider-1',
      'rider-entry-1',
      'DROPPED_OFF',
    )
  })

  it('accepts CANCELLED for a wrong-vehicle scan', async () => {
    driverSessionMock.applyRiderTripAction.mockResolvedValue({
      status: 'CANCELLED',
      message: 'Cancel trip saved.',
    })

    const response = await POST(makeRequest({ action: 'CANCELLED' }), params)

    expect(response.status).toBe(200)
  })

  it('rejects an unknown action without touching the service', async () => {
    const response = await POST(makeRequest({ action: 'ACCEPT' }), params)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('INVALID_RIDER_ACTION')
    expect(driverSessionMock.applyRiderTripAction).not.toHaveBeenCalled()
  })

  it('rejects a missing action', async () => {
    const response = await POST(makeRequest({}), params)

    expect(response.status).toBe(400)
  })

  it('surfaces the service error code so mobile can read it', async () => {
    driverSessionMock.applyRiderTripAction.mockRejectedValue(
      new FakeDriverSessionError('Not your trip.', 404, 'SESSION_RIDER_NOT_FOUND'),
    )

    const response = await POST(makeRequest({ action: 'DROPPED_OFF' }), params)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.code).toBe('SESSION_RIDER_NOT_FOUND')
  })

  it('is PUBLIC-only', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Unauthorized'))

    const response = await POST(makeRequest({ action: 'DROPPED_OFF' }), params)

    expect(response.status).toBe(401)
  })
})
