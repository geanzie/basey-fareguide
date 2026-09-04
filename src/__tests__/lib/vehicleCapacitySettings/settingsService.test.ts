import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  vehicleCapacitySettings: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  DEFAULT_SEAT_CAPACITIES,
  MAX_SEAT_CAPACITY,
  getSeatCapacityStandard,
  invalidateVehicleCapacitySettingsCache,
  parseSeatCapacities,
  resolveSeatCapacity,
} from '@/lib/vehicleCapacitySettings/settingsService'

function storedRow(habalHabalCapacity: number, tricycleCapacity: number) {
  prismaMock.vehicleCapacitySettings.findUnique.mockResolvedValue({
    id: 'global',
    habalHabalCapacity,
    tricycleCapacity,
    updatedBy: null,
    updatedAt: new Date('2026-09-04T00:00:00.000Z'),
    updatedByUser: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateVehicleCapacitySettingsCache()
  process.env.DATABASE_URL ||= 'postgresql://test'
})

describe('resolveSeatCapacity', () => {
  it('uses the type standard when the vehicle sets no override', async () => {
    storedRow(3, 6)

    await expect(resolveSeatCapacity('HABAL_HABAL', null)).resolves.toBe(3)
    await expect(resolveSeatCapacity('TRICYCLE', null)).resolves.toBe(6)
  })

  it('lets a per-vehicle override lower the standard', async () => {
    storedRow(3, 6)

    // A habal-habal that safely seats two, not three.
    await expect(resolveSeatCapacity('HABAL_HABAL', 2)).resolves.toBe(2)
  })

  it('never lets a per-vehicle override raise the standard', async () => {
    storedRow(3, 6)

    // Capacity is the charter price multiplier. If an encoder could raise it,
    // registering a vehicle would be a direct revenue lever.
    await expect(resolveSeatCapacity('HABAL_HABAL', 9)).resolves.toBe(3)
    await expect(resolveSeatCapacity('TRICYCLE', 100)).resolves.toBe(6)
  })

  it('ignores a nonsense override rather than blocking every scan', async () => {
    storedRow(3, 6)

    for (const override of [0, -2, 1.5, Number.NaN]) {
      await expect(resolveSeatCapacity('HABAL_HABAL', override)).resolves.toBe(3)
    }
  })

  it('returns null for a type the municipality does not seat-manage', async () => {
    storedRow(3, 6)

    // Null means "no ceiling, no charter" — not a ceiling of zero, which would
    // refuse every rider on a jeepney.
    await expect(resolveSeatCapacity('JEEPNEY', null)).resolves.toBeNull()
    await expect(resolveSeatCapacity('BUS', 12)).resolves.toBeNull()
    await expect(resolveSeatCapacity(null, null)).resolves.toBeNull()
  })

  it('falls back to the shipped standard when no row exists', async () => {
    prismaMock.vehicleCapacitySettings.findUnique.mockResolvedValue(null)

    await expect(getSeatCapacityStandard('HABAL_HABAL')).resolves.toBe(
      DEFAULT_SEAT_CAPACITIES.HABAL_HABAL,
    )
  })

  it('falls back to the standard rather than to no ceiling when the table is missing', async () => {
    prismaMock.vehicleCapacitySettings.findUnique.mockRejectedValue(
      new Error('P2021: The table `vehicle_capacity_settings` does not exist'),
    )

    // No ceiling at all would silently re-permit the overcharge this exists to
    // catch; an over-tight ceiling only costs a rider one refused scan.
    await expect(getSeatCapacityStandard('TRICYCLE')).resolves.toBe(
      DEFAULT_SEAT_CAPACITIES.TRICYCLE,
    )
  })
})

describe('parseSeatCapacities', () => {
  it('keeps only seat-managed types', () => {
    expect(
      parseSeatCapacities({ HABAL_HABAL: 3, TRICYCLE: 6, JEEPNEY: 20 }),
    ).toEqual({ HABAL_HABAL: 3, TRICYCLE: 6 })
  })

  it('drops values outside the allowed range instead of forwarding them', () => {
    expect(
      parseSeatCapacities({ HABAL_HABAL: 0, TRICYCLE: MAX_SEAT_CAPACITY + 1 }),
    ).toEqual({})
  })

  it('drops fractional and unparseable values', () => {
    expect(parseSeatCapacities({ HABAL_HABAL: 2.5, TRICYCLE: 'six' })).toEqual({})
  })

  it('accepts numeric strings, which is what a form sends', () => {
    expect(parseSeatCapacities({ HABAL_HABAL: '3' })).toEqual({ HABAL_HABAL: 3 })
  })

  it('returns nothing for junk input', () => {
    expect(parseSeatCapacities(null)).toEqual({})
    expect(parseSeatCapacities('nope')).toEqual({})
  })
})
