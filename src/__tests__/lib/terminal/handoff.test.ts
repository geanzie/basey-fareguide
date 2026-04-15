// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearQrTerminalHandoff,
  QR_TERMINAL_HANDOFF_STORAGE_KEY,
  QR_TERMINAL_HANDOFF_TTL_MS,
  readQrTerminalHandoff,
  storeQrTerminalHandoff,
} from '@/lib/terminal/handoff'

const snapshot = {
  permitId: 'permit-1',
  vehicleId: 'vehicle-1',
  operatorId: null,
  scannedTokenFingerprint: 'sha256:demo-token-fingerprint',
  permitStatusAtScan: 'ACTIVE',
  complianceStatus: 'REVIEW_REQUIRED',
  scanDispositionAtScan: 'FLAGGED',
  complianceFlags: ['open-incidents'],
  complianceChecklistAtScan: [],
  violationSummary: {
    totalViolations: 1,
    openIncidents: 1,
    unpaidTickets: 1,
    outstandingPenalties: 500,
  },
  operator: {
    operatorId: null,
    operatorIdStatus: 'UNAVAILABLE',
    driverFullName: 'Pedro Santos',
    driverName: 'Pedro Santos',
    ownerName: 'Juan Dela Cruz',
    driverLicense: 'D-12345',
  },
  vehicle: {
    id: 'vehicle-1',
    plateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
    make: 'Honda',
    model: 'Wave',
    color: 'Blue',
    ownerName: 'Juan Dela Cruz',
    driverName: 'Pedro Santos',
    driverLicense: 'D-12345',
    registrationExpiry: '2027-01-01T00:00:00.000Z',
    insuranceExpiry: null,
    isActive: true,
  },
}

describe('qr terminal handoff storage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('stores the handoff in both session and local storage and restores from local storage after a refresh', () => {
    storeQrTerminalHandoff(snapshot)

    const sessionValue = sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)
    const localValue = localStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)

    expect(sessionValue).not.toBeNull()
    expect(localValue).not.toBeNull()

    sessionStorage.removeItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)

    expect(readQrTerminalHandoff()).toEqual(snapshot)
    expect(sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).not.toBeNull()
  })

  it('migrates legacy session-only snapshots into the durable TTL-backed format', () => {
    sessionStorage.setItem(QR_TERMINAL_HANDOFF_STORAGE_KEY, JSON.stringify(snapshot))

    expect(readQrTerminalHandoff()).toEqual(snapshot)

    const persistedLocalValue = localStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)

    expect(persistedLocalValue).not.toBeNull()
    expect(persistedLocalValue).toContain('expiresAt')
    expect(persistedLocalValue).toContain('storedAt')
  })

  it('clears expired handoff records instead of restoring stale queue context', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'))

    storeQrTerminalHandoff(snapshot)
    vi.setSystemTime(new Date(Date.now() + QR_TERMINAL_HANDOFF_TTL_MS + 1))

    expect(readQrTerminalHandoff()).toBeNull()
    expect(sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).toBeNull()
  })

  it('clears both storage backends when the handoff is dismissed', () => {
    storeQrTerminalHandoff(snapshot)

    clearQrTerminalHandoff()

    expect(sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).toBeNull()
  })
})