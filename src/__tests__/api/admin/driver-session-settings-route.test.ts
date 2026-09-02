import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const settingsMock = vi.hoisted(() => ({
  getAdminDriverSessionSettings: vi.fn(),
  updateDriverSessionSettings: vi.fn(),
}))

const driverSessionMock = vi.hoisted(() => ({
  closeSessionsForSuspendedVehicleTypes: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/driverSession', () => ({
  closeSessionsForSuspendedVehicleTypes:
    driverSessionMock.closeSessionsForSuspendedVehicleTypes,
}))

vi.mock('@/lib/driverSessionSettings/settingsService', async () => {
  const { VehicleType } = await import('@prisma/client')
  const ALL = Object.values(VehicleType) as string[]

  class DriverSessionSettingsMigrationRequiredError extends Error {}

  return {
    DriverSessionSettingsMigrationRequiredError,
    getAdminDriverSessionSettings: settingsMock.getAdminDriverSessionSettings,
    updateDriverSessionSettings: settingsMock.updateDriverSessionSettings,
    parseVehicleTypes: (input: unknown) =>
      Array.isArray(input)
        ? ALL.filter((type) => input.includes(type))
        : [],
  }
})

import { GET, PATCH } from '@/app/api/admin/settings/driver-sessions/route'

function makePatch(body: unknown) {
  return new Request('http://localhost/api/admin/settings/driver-sessions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  driverSessionMock.closeSessionsForSuspendedVehicleTypes.mockResolvedValue(0)
})

describe('GET /api/admin/settings/driver-sessions', () => {
  it('is ADMIN-only', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))

    const response = await GET(
      new Request('http://localhost/api/admin/settings/driver-sessions') as never,
    )

    expect(response.status).toBe(403)
  })

  it('returns the current suspension', async () => {
    settingsMock.getAdminDriverSessionSettings.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE'],
      availableVehicleTypes: ['JEEPNEY', 'TRICYCLE'],
      lastUpdatedById: null,
      lastUpdatedByName: null,
      lastUpdatedAt: null,
    })

    const response = await GET(
      new Request('http://localhost/api/admin/settings/driver-sessions') as never,
    )

    expect(response.status).toBe(200)
    expect((await response.json()).suspendedVehicleTypes).toEqual(['TRICYCLE'])
  })
})

describe('PATCH /api/admin/settings/driver-sessions', () => {
  it('saves the list and closes sessions for newly suspended types', async () => {
    settingsMock.updateDriverSessionSettings.mockResolvedValue({
      changed: true,
      newlySuspended: ['JEEPNEY'],
      settings: { suspendedVehicleTypes: ['TRICYCLE', 'JEEPNEY'] },
    })
    driverSessionMock.closeSessionsForSuspendedVehicleTypes.mockResolvedValue(2)

    const response = await PATCH(
      makePatch({ suspendedVehicleTypes: ['TRICYCLE', 'JEEPNEY'] }),
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ success: true, changed: true, closedSessions: 2 })
    expect(
      driverSessionMock.closeSessionsForSuspendedVehicleTypes,
    ).toHaveBeenCalledWith(['JEEPNEY'])
  })

  it('accepts an empty list, which resumes driver acceptance everywhere', async () => {
    settingsMock.updateDriverSessionSettings.mockResolvedValue({
      changed: true,
      newlySuspended: [],
      settings: { suspendedVehicleTypes: [] },
    })

    const response = await PATCH(makePatch({ suspendedVehicleTypes: [] }))

    expect(response.status).toBe(200)
    expect(
      driverSessionMock.closeSessionsForSuspendedVehicleTypes,
    ).not.toHaveBeenCalled()
  })

  it('rejects a value that is not a vehicle type', async () => {
    const response = await PATCH(makePatch({ suspendedVehicleTypes: ['TRICYCLE', 'SCOOTER'] }))

    expect(response.status).toBe(400)
    expect(settingsMock.updateDriverSessionSettings).not.toHaveBeenCalled()
  })

  it('rejects a non-array body', async () => {
    const response = await PATCH(makePatch({ suspendedVehicleTypes: 'TRICYCLE' }))

    expect(response.status).toBe(400)
  })

  it('is ADMIN-only', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Unauthorized'))

    const response = await PATCH(makePatch({ suspendedVehicleTypes: [] }))

    expect(response.status).toBe(401)
  })
})
