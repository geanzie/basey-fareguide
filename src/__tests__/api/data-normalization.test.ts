/**
 * Phase 5 regression tests: data normalization at write boundaries.
 * Covers plate normalization on vehicle/permit create and coordinate validation on location create.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  permit: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  location: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
  ADMIN_OR_ENCODER: ['ADMIN', 'ENCODER'],
  ADMIN_ONLY: ['ADMIN'],
}))

const serializersMock = vi.hoisted(() => ({
  serializeVehicle: vi.fn((v: unknown) => v),
  serializePermit: vi.fn((p: unknown) => p),
}))

const qrMock = vi.hoisted(() => ({
  createPermitWithQr: vi.fn(),
}))

const plannerMock = vi.hoisted(() => ({
  invalidatePlannerLocationsCache: vi.fn(),
}))

const locationValidationMock = vi.hoisted(() => ({
  buildLocationValidationLog: vi.fn(),
  buildLocationValidationSummary: vi.fn(() => ({})),
}))

const paginationMock = vi.hoisted(() => ({
  parsePaginationParams: vi.fn(() => ({ skip: 0, limit: 20 })),
  buildPaginationMetadata: vi.fn(() => ({ total: 0 })),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/serializers', () => serializersMock)
vi.mock('@/lib/permits/qr', () => qrMock)
vi.mock('@/lib/locations/plannerLocations', () => plannerMock)
vi.mock('@/utils/locationValidation', () => locationValidationMock)
vi.mock('@/lib/api/pagination', () => paginationMock)

// ---------------------------------------------------------------------------
// Subject imports
// ---------------------------------------------------------------------------

import { POST as vehiclePost } from '@/app/api/vehicles/route'
import { POST as permitPost } from '@/app/api/permits/route'
import { POST as locationPost } from '@/app/api/admin/locations/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

const ADMIN_USER = { id: 'admin-1', userType: 'ADMIN' }
const ENCODER_USER = { id: 'encoder-1', userType: 'ENCODER' }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue(ENCODER_USER)
  prismaMock.vehicle.findUnique.mockResolvedValue(null)
  prismaMock.vehicle.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'v-1', ...data }),
  )
  prismaMock.permit.findUnique.mockResolvedValue(null)
  qrMock.createPermitWithQr.mockResolvedValue({ id: 'p-1' })
  prismaMock.location.findUnique.mockResolvedValue(null)
  prismaMock.location.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'l-1', ...data }),
  )
})

// ---------------------------------------------------------------------------
// 1. Vehicle plate normalization
// ---------------------------------------------------------------------------

describe('POST /api/vehicles — plate normalization', () => {
  const baseBody = {
    plateNumber: 'abc-1234',
    vehicleType: 'TRICYCLE',
    make: 'Honda',
    model: 'TMX',
    year: 2020,
    color: 'Red',
    capacity: 3,
    ownerName: 'Juan',
    ownerContact: '09001234567',
    registrationExpiry: '2027-01-01',
  }

  it('normalizes plateNumber to uppercase+trimmed before create', async () => {
    const res = await vehiclePost(makeRequest('http://localhost/api/vehicles', baseBody))
    expect(res.status).toBe(201)
    const createCall = prismaMock.vehicle.create.mock.calls[0][0]
    expect(createCall.data.plateNumber).toBe('ABC-1234')
  })

  it('uses normalized plate for the dedup uniqueness check', async () => {
    await vehiclePost(makeRequest('http://localhost/api/vehicles', { ...baseBody, plateNumber: '  abc-1234  ' }))
    expect(prismaMock.vehicle.findUnique).toHaveBeenCalledWith({ where: { plateNumber: 'ABC-1234' } })
  })

  it('rejects a blank/invalid plateNumber with 400', async () => {
    const res = await vehiclePost(makeRequest('http://localhost/api/vehicles', { ...baseBody, plateNumber: '   ' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/plate/i)
  })

  it('returns 409 when normalized plate already exists', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'existing', plateNumber: 'ABC-1234' })
    const res = await vehiclePost(makeRequest('http://localhost/api/vehicles', baseBody))
    expect(res.status).toBe(409)
  })
})

// ---------------------------------------------------------------------------
// 2. Permit plate normalization
// ---------------------------------------------------------------------------

describe('POST /api/permits — plate normalization', () => {
  const baseBody = {
    vehicleId: 'v-1',
    permitPlateNumber: ' abc-1234 ',
    driverFullName: 'Juan Cruz',
    vehicleType: 'TRICYCLE',
  }

  it('normalizes permitPlateNumber to uppercase+trimmed before create', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'v-1', plateNumber: 'ABC-1234' })
    await permitPost(makeRequest('http://localhost/api/permits', baseBody))
    const createCall = qrMock.createPermitWithQr.mock.calls[0][0]
    expect(createCall.permitPlateNumber).toBe('ABC-1234')
  })

  it('uses normalized plate for the dedup uniqueness check', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'v-1', plateNumber: 'ABC-1234' })
    await permitPost(makeRequest('http://localhost/api/permits', baseBody))
    expect(prismaMock.permit.findUnique).toHaveBeenCalledWith({
      where: { permitPlateNumber: 'ABC-1234' },
    })
  })

  it('rejects blank permitPlateNumber with 400', async () => {
    const res = await permitPost(
      makeRequest('http://localhost/api/permits', { ...baseBody, permitPlateNumber: '   ' }),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/plate/i)
  })
})

// ---------------------------------------------------------------------------
// 3. Location coordinate validation
// ---------------------------------------------------------------------------

describe('POST /api/admin/locations — coordinate validation', () => {
  beforeEach(() => {
    authMock.requireRequestRole.mockResolvedValue(ADMIN_USER)
  })

  const baseBody = {
    name: 'Test Stop',
    type: 'TERMINAL',
    coordinates: '10.3157,123.8854',
  }

  it('accepts well-formed coordinates', async () => {
    const res = await locationPost(makeRequest('http://localhost/api/admin/locations', baseBody))
    expect(res.status).toBe(201)
  })

  it('rejects non-numeric coordinate string', async () => {
    const res = await locationPost(
      makeRequest('http://localhost/api/admin/locations', { ...baseBody, coordinates: 'invalid' }),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/coordinates/i)
  })

  it('rejects latitude out of range', async () => {
    const res = await locationPost(
      makeRequest('http://localhost/api/admin/locations', { ...baseBody, coordinates: '91.0,123.0' }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects longitude out of range', async () => {
    const res = await locationPost(
      makeRequest('http://localhost/api/admin/locations', { ...baseBody, coordinates: '10.0,181.0' }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects single-value coordinate string', async () => {
    const res = await locationPost(
      makeRequest('http://localhost/api/admin/locations', { ...baseBody, coordinates: '10.3157' }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts negative coordinates (southern/western hemisphere)', async () => {
    const res = await locationPost(
      makeRequest('http://localhost/api/admin/locations', { ...baseBody, coordinates: '-10.3157,-123.8854' }),
    )
    expect(res.status).toBe(201)
  })
})
