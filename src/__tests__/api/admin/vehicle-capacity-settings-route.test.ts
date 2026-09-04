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
  getAdminVehicleCapacitySettings: vi.fn(),
  updateVehicleCapacitySettings: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/vehicleCapacitySettings/settingsService', () => {
  class VehicleCapacitySettingsMigrationRequiredError extends Error {}

  const CONFIGURABLE = ['HABAL_HABAL', 'TRICYCLE']

  return {
    VehicleCapacitySettingsMigrationRequiredError,
    getAdminVehicleCapacitySettings: settingsMock.getAdminVehicleCapacitySettings,
    updateVehicleCapacitySettings: settingsMock.updateVehicleCapacitySettings,
    parseSeatCapacities: (input: unknown) => {
      if (!input || typeof input !== 'object') return {}
      const source = input as Record<string, unknown>
      const parsed: Record<string, number> = {}
      for (const type of CONFIGURABLE) {
        const value = Number(source[type])
        if (Number.isInteger(value) && value >= 1 && value <= 8) {
          parsed[type] = value
        }
      }
      return parsed
    },
  }
})

import { GET, PATCH } from '@/app/api/admin/settings/vehicle-capacity/route'

const SETTINGS = {
  seatCapacities: { HABAL_HABAL: 3, TRICYCLE: 6 },
  configurableVehicleTypes: ['HABAL_HABAL', 'TRICYCLE'],
  minCapacity: 1,
  maxCapacity: 8,
  lastUpdatedById: null,
  lastUpdatedByName: null,
  lastUpdatedAt: null,
  warning: null,
}

function makePatch(body: unknown) {
  return new Request('http://localhost/api/admin/settings/vehicle-capacity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  settingsMock.getAdminVehicleCapacitySettings.mockResolvedValue(SETTINGS)
  settingsMock.updateVehicleCapacitySettings.mockResolvedValue({
    changed: true,
    settings: SETTINGS,
  })
})

describe('GET /api/admin/settings/vehicle-capacity', () => {
  it('returns the current standard to an admin', async () => {
    const response = await GET({} as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(SETTINGS)
  })

  it('refuses a caller who is not an admin', async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error('Forbidden'))

    expect((await GET({} as never)).status).toBe(403)
  })
})

describe('PATCH /api/admin/settings/vehicle-capacity', () => {
  it('saves a valid standard', async () => {
    const response = await PATCH(makePatch({ seatCapacities: { HABAL_HABAL: 2, TRICYCLE: 4 } }))

    expect(response.status).toBe(200)
    expect(settingsMock.updateVehicleCapacitySettings).toHaveBeenCalledWith({
      seatCapacities: { HABAL_HABAL: 2, TRICYCLE: 4 },
      adminUserId: 'admin-1',
    })
  })

  it('rejects a body with no seatCapacities object', async () => {
    const response = await PATCH(makePatch({ seatCapacities: 6 }))

    expect(response.status).toBe(400)
    expect(settingsMock.updateVehicleCapacitySettings).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range seat count rather than saving part of the change', async () => {
    // Silently keeping the old number for one type would let an admin believe
    // they had lowered a ceiling they had not.
    const response = await PATCH(makePatch({ seatCapacities: { HABAL_HABAL: 0, TRICYCLE: 6 } }))

    expect(response.status).toBe(400)
    expect(settingsMock.updateVehicleCapacitySettings).not.toHaveBeenCalled()
  })

  it('rejects a vehicle type the municipality does not seat-manage', async () => {
    const response = await PATCH(makePatch({ seatCapacities: { JEEPNEY: 20 } }))

    expect(response.status).toBe(400)
    expect(settingsMock.updateVehicleCapacitySettings).not.toHaveBeenCalled()
  })

  it('answers 503 while the settings table is unmigrated', async () => {
    const { VehicleCapacitySettingsMigrationRequiredError } = await import(
      '@/lib/vehicleCapacitySettings/settingsService'
    )
    settingsMock.updateVehicleCapacitySettings.mockRejectedValue(
      new VehicleCapacitySettingsMigrationRequiredError(),
    )

    const response = await PATCH(makePatch({ seatCapacities: { HABAL_HABAL: 3, TRICYCLE: 6 } }))

    expect(response.status).toBe(503)
  })

  it('tells the admin that running trips keep the capacity they opened with', async () => {
    const response = await PATCH(makePatch({ seatCapacities: { HABAL_HABAL: 2, TRICYCLE: 4 } }))

    expect((await response.json()).message).toContain('keep the capacity they opened with')
  })
})
