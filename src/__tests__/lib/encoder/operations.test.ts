import { describe, expect, it } from 'vitest'
import {
  buildEvent,
  buildExpiryOutlook,
  buildQueueItem,
  paymentLagDays,
  qrEventKind,
  sortEventsDesc,
  toPesos,
} from '@/lib/encoder/operations'

describe('toPesos', () => {
  it('reads Prisma Decimals, numbers and numeric strings', () => {
    expect(toPesos({ toString: () => '1500.50' })).toBe(1500.5)
    expect(toPesos(300)).toBe(300)
    expect(toPesos('75')).toBe(75)
  })

  it('returns null for missing or non-numeric values', () => {
    expect(toPesos(null)).toBeNull()
    expect(toPesos(undefined)).toBeNull()
    expect(toPesos('abc')).toBeNull()
  })
})

describe('buildEvent', () => {
  it('stamps group, Manila time parts and a kind-scoped id', () => {
    // 2026-09-20 17:30 UTC = 2026-09-21 01:30 Manila, a Monday.
    const event = buildEvent('PAYMENT_RECORDED', 'inc-1', new Date('2026-09-20T17:30:00.000Z'), {
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      amount: 500,
      lagDays: 2,
    })
    expect(event).toEqual({
      id: 'PAYMENT_RECORDED:inc-1',
      kind: 'PAYMENT_RECORDED',
      group: 'PAYMENTS',
      at: '2026-09-20T17:30:00.000Z',
      day: '2026-09-21',
      hour: 1,
      weekday: 1,
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      amount: 500,
      lagDays: 2,
    })
  })

  it('turns empty plate and type into null', () => {
    const event = buildEvent('VEHICLE_REGISTERED', 'v-1', new Date(), { plateNumber: '', vehicleType: '' })
    expect(event.plateNumber).toBeNull()
    expect(event.vehicleType).toBeNull()
    expect(event.amount).toBeNull()
  })
})

describe('qrEventKind', () => {
  it('maps every QR audit action and ignores unknown ones', () => {
    expect(qrEventKind('ISSUE_QR')).toBe('QR_ISSUED')
    expect(qrEventKind('ROTATE_QR')).toBe('QR_ROTATED')
    expect(qrEventKind('PRINT_QR')).toBe('QR_PRINTED')
    expect(qrEventKind('SOMETHING_ELSE')).toBeNull()
  })
})

describe('paymentLagDays', () => {
  it('measures days from ticket to payment, never negative', () => {
    const ticket = new Date('2026-09-01T00:00:00.000Z')
    expect(paymentLagDays(ticket, new Date('2026-09-04T12:00:00.000Z'))).toBe(3.5)
    expect(paymentLagDays(ticket, new Date('2026-08-30T00:00:00.000Z'))).toBe(0)
  })

  it('is null without a ticket date', () => {
    expect(paymentLagDays(null, new Date())).toBeNull()
  })
})

describe('sortEventsDesc', () => {
  it('puts the newest first and breaks ties by id', () => {
    const at = new Date('2026-09-20T02:00:00.000Z')
    const events = [
      buildEvent('PERMIT_ISSUED', 'a', new Date('2026-09-19T02:00:00.000Z')),
      buildEvent('PERMIT_ISSUED', 'b', at),
      buildEvent('PERMIT_RENEWED', 'c', at),
    ]
    expect(sortEventsDesc(events).map((event) => event.id)).toEqual([
      'PERMIT_RENEWED:c',
      'PERMIT_ISSUED:b',
      'PERMIT_ISSUED:a',
    ])
  })
})

describe('buildQueueItem', () => {
  it('links each kind to the page that clears it', () => {
    const item = buildQueueItem('VEHICLE_NO_PERMIT', 'v-1', {
      plateNumber: 'XYZ-9',
      vehicleType: 'HABAL_HABAL',
      dueAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(item).toEqual({
      id: 'VEHICLE_NO_PERMIT:v-1',
      kind: 'VEHICLE_NO_PERMIT',
      plateNumber: 'XYZ-9',
      vehicleType: 'HABAL_HABAL',
      dueAt: '2026-09-01T00:00:00.000Z',
      amount: null,
      reference: null,
      href: '/encoder/permits?modal=add-permit',
    })
    expect(buildQueueItem('UNPAID_TICKET', 'i', {}).href).toBe('/encoder/ticket-payments')
    expect(buildQueueItem('REGISTRATION_EXPIRING', 'v', {}).href).toBe('/encoder/vehicles')
  })
})

describe('buildExpiryOutlook', () => {
  it('counts expiries by Manila week (Monday start) and vehicle type', () => {
    const outlook = buildExpiryOutlook([
      // Sunday 2026-09-27 20:00 UTC = Monday 2026-09-28 04:00 Manila.
      { expiryDate: new Date('2026-09-27T20:00:00.000Z'), vehicleType: 'TRICYCLE' },
      { expiryDate: new Date('2026-10-02T03:00:00.000Z'), vehicleType: 'TRICYCLE' },
      // Sunday 2026-09-27 03:00 UTC is still Sunday in Manila: week of Sep 21.
      { expiryDate: new Date('2026-09-27T03:00:00.000Z'), vehicleType: 'HABAL_HABAL' },
    ])
    expect(outlook).toEqual([
      { weekStart: '2026-09-21', vehicleType: 'HABAL_HABAL', count: 1 },
      { weekStart: '2026-09-28', vehicleType: 'TRICYCLE', count: 2 },
    ])
  })
})
