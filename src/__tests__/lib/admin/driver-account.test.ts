import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

import {
  generateTempPassword,
  provisionDriverAccount,
  splitDriverDisplayName,
} from '@/lib/admin/driver-account'

describe('splitDriverDisplayName', () => {
  it('splits a multi-word name into first and last', () => {
    expect(splitDriverDisplayName('Juan Dela Cruz')).toEqual({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
    })
  })

  it('uses a placeholder last name for a single-word name', () => {
    expect(splitDriverDisplayName('Madonna')).toEqual({
      firstName: 'Madonna',
      lastName: 'Driver',
    })
  })

  it('collapses extra whitespace', () => {
    expect(splitDriverDisplayName('  Jose   Rizal  ')).toEqual({
      firstName: 'Jose',
      lastName: 'Rizal',
    })
  })
})

describe('generateTempPassword', () => {
  it('returns a non-empty string', () => {
    expect(generateTempPassword().length).toBeGreaterThan(0)
  })
})

function makeTx(existingUser: { username: string } | null) {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue(existingUser),
      create: vi
        .fn()
        .mockImplementation(
          ({ data }: { data: { username: string; firstName: string; lastName: string } }) => ({
            id: 'user-1',
            username: data.username,
            firstName: data.firstName,
            lastName: data.lastName,
          }),
        ),
    },
    adminUserCreation: { create: vi.fn().mockResolvedValue({}) },
    driverVehicleAssignmentHistory: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('provisionDriverAccount', () => {
  const input = {
    vehicleId: 'veh-1',
    plateNumber: ' abc123 ',
    driverFullName: 'Juan Dela Cruz',
    actorId: 'admin-1',
  }

  it('creates an account with a normalized plate username', async () => {
    const tx = makeTx(null)
    const result = await provisionDriverAccount(tx as unknown as Prisma.TransactionClient, input)

    expect(result.created).toBe(true)
    expect(result.username).toBe('ABC123')
    expect(result.tempPassword).toBeTruthy()
    expect(tx.user.create).toHaveBeenCalledOnce()
    expect(tx.driverVehicleAssignmentHistory.create).toHaveBeenCalledOnce()
  })

  it('is idempotent: returns created=false without writing when an account exists', async () => {
    const tx = makeTx({ username: 'ABC123' })
    const result = await provisionDriverAccount(tx as unknown as Prisma.TransactionClient, input)

    expect(result.created).toBe(false)
    expect(result.username).toBe('ABC123')
    expect(result.tempPassword).toBeUndefined()
    expect(tx.user.create).not.toHaveBeenCalled()
  })

  it('throws when the driver name is missing', async () => {
    const tx = makeTx(null)
    await expect(
      provisionDriverAccount(tx as unknown as Prisma.TransactionClient, { ...input, driverFullName: '   ' }),
    ).rejects.toThrow(/driver name/i)
  })
})
