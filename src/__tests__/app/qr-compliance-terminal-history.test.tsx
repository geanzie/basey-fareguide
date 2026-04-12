// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const scannerState = vi.hoisted(() => ({
  clear: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'enforcer-1',
      userType: 'ENFORCER',
    },
    status: 'authenticated',
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/components/dashboardIcons', () => ({
  DASHBOARD_ICONS: {
    camera: 'camera',
    close: 'close',
    history: 'history',
  },
  DASHBOARD_ICON_POLICY: {
    sizes: {
      button: 16,
      section: 20,
    },
  },
  DashboardIconSlot: () => React.createElement('span', { 'data-testid': 'dashboard-icon' }),
  getDashboardIconChipClasses: () => 'icon-chip',
}))

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = false

    start = scannerState.start
    stop = scannerState.stop
    clear = scannerState.clear
  },
}))

import QrComplianceTerminal from '@/components/QrComplianceTerminal'

function makeJsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function getTerminalShell(container: HTMLDivElement) {
  return container.querySelector('.app-surface-overlay') as HTMLDivElement | null
}

function makeLookupResult(overrides?: {
  incidentHandoff?: Record<string, unknown> | null
  vehicle?: Record<string, unknown> | null
  violationSummary?: Record<string, unknown>
}) {
  const vehicle = overrides?.vehicle ?? {
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
  }

  const violationSummary = {
    totalViolations: 2,
    openIncidents: 1,
    unpaidTickets: 1,
    outstandingPenalties: 350,
    recentViolations: [],
    ...(overrides?.violationSummary ?? {}),
  }

  const incidentHandoff = overrides?.incidentHandoff === undefined
    ? {
        permitId: 'permit-1',
        vehicleId: vehicle ? 'vehicle-1' : null,
        operatorId: null,
        scannedTokenFingerprint: 'sha256:terminal-token',
        permitStatusAtScan: 'ACTIVE',
        complianceStatus: 'COMPLIANT',
        scanDispositionAtScan: 'CLEAR',
        complianceFlags: [],
        complianceChecklistAtScan: [],
        violationSummary: {
          totalViolations: violationSummary.totalViolations,
          openIncidents: violationSummary.openIncidents,
          unpaidTickets: violationSummary.unpaidTickets,
          outstandingPenalties: violationSummary.outstandingPenalties,
        },
        operator: {
          operatorId: null,
          operatorIdStatus: 'UNAVAILABLE',
          driverFullName: 'Pedro Santos',
          driverName: 'Pedro Santos',
          ownerName: 'Juan Dela Cruz',
          driverLicense: 'D-12345',
        },
        vehicle,
      }
    : overrides.incidentHandoff

  return {
    scannedToken: 'qr-token-lookup',
    matchFound: true,
    permitStatus: 'ACTIVE',
    complianceStatus: 'COMPLIANT',
    scanDisposition: 'CLEAR',
    permit: null,
    vehicle,
    operator: {
      operatorId: null,
      operatorIdStatus: 'UNAVAILABLE',
      driverFullName: 'Pedro Santos',
      driverName: 'Pedro Santos',
      ownerName: 'Juan Dela Cruz',
      driverLicense: 'D-12345',
    },
    complianceChecklist: [
      {
        key: 'permit-valid',
        label: 'Permit validity',
        status: 'PASS',
        detail: 'Permit is active for field validation.',
      },
      {
        key: 'open-incidents',
        label: 'Open incidents',
        status: 'REVIEW',
        detail: '1 open incident still needs review.',
      },
    ],
    violationSummary,
    incidentHandoff,
    message: 'Permit is clear for compliance validation.',
  }
}

async function openAndUnlockTerminal(container: HTMLDivElement) {
  const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null
  expect(openButton).not.toBeNull()

  await act(async () => {
    openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })

  const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
  expect(passwordInput).not.toBeNull()

  await act(async () => {
    setInputValue(passwordInput!, 'correct-password')
    await Promise.resolve()
  })

  const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Unlock Terminal'),
  )

  expect(unlockButton).toBeTruthy()

  await act(async () => {
    unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function showLookupResult(container: HTMLDivElement, token: string) {
  const manualEntryButton = container.querySelector('button[aria-label="Manual Entry"]') as HTMLButtonElement | null
  expect(manualEntryButton).not.toBeNull()

  await act(async () => {
    manualEntryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })

  const manualInput = container.querySelector('#manual-qr-token') as HTMLInputElement | null
  expect(manualInput).not.toBeNull()

  await act(async () => {
    setInputValue(manualInput!, token)
    await Promise.resolve()
  })

  const checkButton = Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Check Permit'),
  )

  expect(checkButton).toBeTruthy()

  await act(async () => {
    checkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('QrComplianceTerminal history', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let lookupResponseBody: unknown | null

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()

    scannerState.clear.mockReset()
    scannerState.start.mockReset()
    scannerState.stop.mockReset()
    scannerState.start.mockResolvedValue(undefined)
    scannerState.stop.mockImplementation(() => {
      throw new Error('Cannot stop, scanner is not running or paused.')
    })

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
    })

    routerPush.mockReset()
    lookupResponseBody = null

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === '/api/terminal/unlock') {
        return Promise.resolve(makeJsonResponse({
          unlocked: true,
          expiresAt: '2026-04-12T10:30:00.000Z',
          lastActivityAt: '2026-04-12T10:00:00.000Z',
          message: 'QR terminal unlocked.',
        }))
      }

      if (url === '/api/terminal/history?limit=8') {
        return Promise.resolve(makeJsonResponse({
          items: [
            {
              id: 'audit-1',
              scannedAt: '2026-04-12T10:00:00.000Z',
              submittedToken: 'qr-token-1',
              resultType: 'MATCHED',
              scanSource: 'CAMERA',
              disposition: 'CLEAR',
              matchedPermitId: 'permit-1',
              permitPlateNumber: 'PERM-100',
              vehiclePlateNumber: 'ABC-123',
            },
          ],
        }, {
          headers: {
            'X-Terminal-Unlock-Expires-At': '2026-04-12T10:35:00.000Z',
          },
        }))
      }

      if (url === '/api/terminal/lookup') {
        if (!lookupResponseBody) {
          throw new Error('Lookup response not configured for this test.')
        }

        return Promise.resolve(makeJsonResponse(lookupResponseBody, {
          headers: {
            'X-Terminal-Unlock-Expires-At': '2026-04-12T10:40:00.000Z',
          },
        }))
      }

      throw new Error(`Unhandled fetch URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })

    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('shows recent scan history after the enforcer unlocks the terminal', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null
    expect(openButton).not.toBeNull()

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )
    expect(unlockButton).toBeTruthy()

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/terminal/history?limit=8')

    const showHistoryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show History'),
    )

    expect(showHistoryButton).toBeTruthy()

    await act(async () => {
      showHistoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(scannerState.clear).toHaveBeenCalled()
    expect(container.textContent).toContain('Recent Scan History')
    expect(container.textContent).toContain('ABC-123')
    expect(container.textContent).toContain('qr-token-1')
    expect(container.textContent).not.toContain('Point the camera at a permit QR.')
    expect(scannerState.start).toHaveBeenCalledTimes(1)

    const refreshButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Refresh'),
    )

    expect(refreshButton).toBeTruthy()

    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(scannerState.start).toHaveBeenCalledTimes(1)
  })

  it('keeps compact height for password and camera states and expands for history', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const initialShell = getTerminalShell(container)
    expect(initialShell).not.toBeNull()
    expect(initialShell?.className).toContain('max-h-[calc(100dvh-1rem)]')
    expect(initialShell?.className).toContain('overflow-y-auto')

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const cameraShell = getTerminalShell(container)
    expect(cameraShell?.className).toContain('max-h-[calc(100dvh-1rem)]')
    expect(cameraShell?.className).toContain('overflow-y-auto')

    const showHistoryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label') === 'Show History',
    )

    expect(showHistoryButton).toBeTruthy()

    await act(async () => {
      showHistoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const historyShell = getTerminalShell(container)
    expect(historyShell?.className).toContain('h-[calc(100dvh-1rem)]')
    expect(historyShell?.className).toContain('overflow-hidden')
  })

  it('does not throw during cleanup when the scanner instance exists but is not running', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(scannerState.start).toHaveBeenCalled()

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })

    expect(scannerState.stop).not.toHaveBeenCalled()
    expect(scannerState.clear).toHaveBeenCalled()

    root = createRoot(container)
  })

  it('routes the incident action to the enforcer queue and stores the resolved vehicle handoff', async () => {
    lookupResponseBody = makeLookupResult()

    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    await openAndUnlockTerminal(container)
    await showLookupResult(container, 'qr-token-lookup')

    expect(container.textContent).toContain('Permit validity')
    expect(container.textContent).toContain('Reported incidents')
    expect(container.textContent).toContain('Outstanding penalties')

    const incidentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Open Incident Report'),
    ) as HTMLButtonElement | undefined

    expect(incidentButton).toBeTruthy()
    expect(incidentButton?.disabled).toBe(false)

    await act(async () => {
      incidentButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(routerPush).toHaveBeenCalledWith('/enforcer/incidents?qrHandoff=1')
    expect(routerPush).not.toHaveBeenCalledWith('/report?qrHandoff=1')

    const storedSnapshot = sessionStorage.getItem('qr-terminal-handoff')
    expect(storedSnapshot).not.toBeNull()
    expect(JSON.parse(storedSnapshot || '{}')).toMatchObject({
      vehicleId: 'vehicle-1',
      vehicle: {
        plateNumber: 'ABC-123',
      },
    })
  })

  it('disables the incident action and shows an explicit enforcer-safe reason when vehicle context is missing', async () => {
    lookupResponseBody = makeLookupResult({
      vehicle: null,
      incidentHandoff: {
        permitId: 'permit-1',
        vehicleId: null,
        operatorId: null,
        scannedTokenFingerprint: 'sha256:terminal-token',
        permitStatusAtScan: 'ACTIVE',
        complianceStatus: 'COMPLIANT',
        scanDispositionAtScan: 'CLEAR',
        complianceFlags: [],
        complianceChecklistAtScan: [],
        violationSummary: {
          totalViolations: 0,
          openIncidents: 0,
          unpaidTickets: 0,
          outstandingPenalties: 0,
        },
        operator: {
          operatorId: null,
          operatorIdStatus: 'UNAVAILABLE',
          driverFullName: 'Pedro Santos',
          driverName: 'Pedro Santos',
          ownerName: 'Juan Dela Cruz',
          driverLicense: 'D-12345',
        },
        vehicle: null,
      },
      violationSummary: {
        totalViolations: 0,
        openIncidents: 0,
        unpaidTickets: 0,
        outstandingPenalties: 0,
      },
    })

    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    await openAndUnlockTerminal(container)
    await showLookupResult(container, 'qr-token-missing-vehicle')

    const incidentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Open Incident Report'),
    ) as HTMLButtonElement | undefined

    expect(incidentButton).toBeTruthy()
    expect(incidentButton?.disabled).toBe(true)
    expect(container.textContent).toContain('Incident reporting stays in the enforcer queue and requires a matched vehicle from the scan.')
    expect(routerPush).not.toHaveBeenCalledWith('/report?qrHandoff=1')
    expect(routerPush).not.toHaveBeenCalledWith('/enforcer/incidents?qrHandoff=1')
  })

  it('keeps only the compact compliance summary fields in the terminal result view', async () => {
    lookupResponseBody = makeLookupResult()

    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    await openAndUnlockTerminal(container)
    await showLookupResult(container, 'qr-token-compact-view')

    expect(container.textContent).toContain('Permit validity')
    expect(container.textContent).toContain('Reported incidents')
    expect(container.textContent).toContain('Outstanding penalties')
    expect(container.textContent).not.toContain('Compliance Summary')
    expect(container.textContent).not.toContain('Vehicle registry status')
    expect(container.textContent).not.toContain('Registration expiry')
    expect(container.textContent).not.toContain('Insurance coverage')
    expect(container.textContent).not.toContain('Unpaid tickets')
    expect(container.textContent).not.toContain('Owner:')
  })
})