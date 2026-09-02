import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  driverSessionSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  driverSessionSettingsAudit: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      driverSessionSettings: prismaMock.driverSessionSettings,
      driverSessionSettingsAudit: prismaMock.driverSessionSettingsAudit,
    }),
  ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import {
  DEFAULT_SUSPENDED_VEHICLE_TYPES,
  getDriverSessionSettings,
  invalidateDriverSessionSettingsCache,
  isDriverAcceptSuspended,
  parseVehicleTypes,
  updateDriverSessionSettings,
} from '@/lib/driverSessionSettings/settingsService'

beforeEach(() => {
  vi.clearAllMocks()
  invalidateDriverSessionSettingsCache()
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test'
})

describe('parseVehicleTypes', () => {
  it('keeps real enum members in enum order', () => {
    expect(parseVehicleTypes(['HABAL_HABAL', 'JEEPNEY'])).toEqual(['JEEPNEY', 'HABAL_HABAL'])
  })

  it('drops values that are not vehicle types', () => {
    expect(parseVehicleTypes(['TRICYCLE', 'SCOOTER', 42, null])).toEqual(['TRICYCLE'])
  })

  it('de-duplicates', () => {
    expect(parseVehicleTypes(['TRICYCLE', 'TRICYCLE'])).toEqual(['TRICYCLE'])
  })

  it('treats a non-array as empty', () => {
    expect(parseVehicleTypes('TRICYCLE')).toEqual([])
  })
})

describe('getDriverSessionSettings', () => {
  it('reads the stored list', async () => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: ['JEEPNEY'],
      updatedBy: null,
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedByUser: null,
    })

    const settings = await getDriverSessionSettings()

    expect(settings.suspendedVehicleTypes).toEqual(['JEEPNEY'])
  })

  it('falls back to the suspended default when the row is missing', async () => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue(null)

    const settings = await getDriverSessionSettings()

    expect(settings.suspendedVehicleTypes).toEqual([...DEFAULT_SUSPENDED_VEHICLE_TYPES])
  })

  it('falls back to the suspended default when the table is not migrated', async () => {
    const migrationError = new Error(
      'The table `public.driver_session_settings` does not exist (P2021)',
    )
    prismaMock.driverSessionSettings.findUnique.mockRejectedValue(migrationError)

    const settings = await getDriverSessionSettings()

    // Fail safe: a driver must never be handed a flow their phone cannot serve.
    expect(settings.suspendedVehicleTypes).toEqual([...DEFAULT_SUSPENDED_VEHICLE_TYPES])
  })

  it('serves the cached value instead of re-reading', async () => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE'],
      updatedBy: null,
      updatedAt: new Date(),
      updatedByUser: null,
    })

    await getDriverSessionSettings()
    await getDriverSessionSettings()

    expect(prismaMock.driverSessionSettings.findUnique).toHaveBeenCalledOnce()
  })
})

describe('isDriverAcceptSuspended', () => {
  beforeEach(() => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
      updatedBy: null,
      updatedAt: new Date(),
      updatedByUser: null,
    })
  })

  it('is true for a suspended type', async () => {
    await expect(isDriverAcceptSuspended('HABAL_HABAL')).resolves.toBe(true)
  })

  it('is false for a type the admin left alone', async () => {
    await expect(isDriverAcceptSuspended('JEEPNEY')).resolves.toBe(false)
  })

  it('is false for a missing vehicle type rather than throwing', async () => {
    await expect(isDriverAcceptSuspended(null)).resolves.toBe(false)
  })
})

describe('updateDriverSessionSettings', () => {
  it('writes the row, the audit trail, and reports what became newly suspended', async () => {
    prismaMock.driverSessionSettings.findUnique
      .mockResolvedValueOnce({ suspendedVehicleTypes: ['TRICYCLE'] })
      .mockResolvedValue({
        suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
        updatedBy: 'admin-1',
        updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        updatedByUser: { firstName: 'Ada', lastName: 'Cruz', username: 'ada' },
      })

    const result = await updateDriverSessionSettings({
      suspendedVehicleTypes: ['TRICYCLE', 'HABAL_HABAL'] as never,
      adminUserId: 'admin-1',
    })

    expect(result.changed).toBe(true)
    expect(result.newlySuspended).toEqual(['HABAL_HABAL'])
    expect(prismaMock.driverSessionSettingsAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousSuspendedTypes: ['TRICYCLE'],
          newSuspendedTypes: ['TRICYCLE', 'HABAL_HABAL'],
          changedBy: 'admin-1',
        }),
      }),
    )
    expect(result.settings.lastUpdatedByName).toBe('Ada Cruz (@ada)')
  })

  it('writes nothing when the list is unchanged', async () => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE'],
      updatedBy: null,
      updatedAt: new Date(),
      updatedByUser: null,
    })

    const result = await updateDriverSessionSettings({
      suspendedVehicleTypes: ['TRICYCLE'] as never,
      adminUserId: 'admin-1',
    })

    expect(result.changed).toBe(false)
    expect(prismaMock.driverSessionSettings.upsert).not.toHaveBeenCalled()
    expect(prismaMock.driverSessionSettingsAudit.create).not.toHaveBeenCalled()
  })

  it('leaves no stale cache behind, so the next read sees the new list', async () => {
    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: [],
      updatedBy: null,
      updatedAt: new Date(),
      updatedByUser: null,
    })

    // Warm the cache with "nothing suspended".
    await expect(
      (await getDriverSessionSettings()).suspendedVehicleTypes,
    ).toEqual([])

    prismaMock.driverSessionSettings.findUnique.mockResolvedValue({
      suspendedVehicleTypes: ['TRICYCLE'],
      updatedBy: 'admin-1',
      updatedAt: new Date(),
      updatedByUser: null,
    })

    await updateDriverSessionSettings({
      suspendedVehicleTypes: ['TRICYCLE'] as never,
      adminUserId: 'admin-1',
    })

    expect((await getDriverSessionSettings()).suspendedVehicleTypes).toEqual(['TRICYCLE'])
    await expect(isDriverAcceptSuspended('TRICYCLE')).resolves.toBe(true)
  })
})
