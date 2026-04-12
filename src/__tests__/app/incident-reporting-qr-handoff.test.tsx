// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const routerReplace = vi.hoisted(() => vi.fn())

const searchParamsMock = {
  get: (key: string) => (key === 'qrHandoff' ? '1' : null),
}

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
  useSearchParams: () => searchParamsMock,
  useRouter: () => ({
    replace: routerReplace,
  }),
}))

vi.mock('@/components/LoadingSpinner', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'loading-spinner' }, 'loading'),
}))

vi.mock('@/components/dashboardIcons', () => ({
  DASHBOARD_ICONS: {
    incidents: 'incidents',
    reports: 'reports',
    check: 'check',
    map: 'map',
  },
  DASHBOARD_ICON_POLICY: {
    sizes: {
      hero: 24,
      alert: 20,
      button: 16,
    },
  },
  DashboardIconSlot: () => React.createElement('span', { 'data-testid': 'dashboard-icon' }),
  getDashboardIconChipClasses: () => 'icon-chip',
}))

vi.mock('@/lib/locations/pinLabelResolver', () => ({
  resolvePinLabel: vi.fn(() => ({
    displayLabel: 'Amandayehan',
    barangayName: 'Amandayehan',
    rawCoordinates: '11.278823, 125.001194',
    isFallback: false,
  })),
}))

vi.mock('@/components/VehicleLookupField', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'vehicle-lookup-field' }, 'Vehicle lookup field'),
}))

import IncidentReporting from '@/components/IncidentReporting'

function makeJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('IncidentReporting public QR boundary', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    routerReplace.mockReset()

    sessionStorage.clear()
    sessionStorage.setItem(
      'qr-terminal-handoff',
      JSON.stringify({
        permitId: 'permit-1',
        vehicleId: 'vehicle-1',
        operatorId: null,
        scannedTokenFingerprint: 'sha256:demo-token-fingerprint',
        permitStatusAtScan: 'ACTIVE',
        complianceStatus: 'REVIEW_REQUIRED',
        scanDispositionAtScan: 'FLAGGED',
        complianceFlags: ['open-incidents'],
        complianceChecklistAtScan: [
          {
            key: 'open-incidents',
            label: 'Open incidents',
            status: 'REVIEW',
            detail: '1 open incident still needs review.',
          },
        ],
        violationSummary: {
          totalViolations: 2,
          openIncidents: 1,
          unpaidTickets: 1,
          outstandingPenalties: 350,
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
      }),
    )

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/fare-calculations')) {
        return Promise.resolve(makeJsonResponse({
          calculations: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
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

  it('redirects terminal-origin QR handoff away from the public incident workflow', async () => {
    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(routerReplace).toHaveBeenCalledWith('/enforcer/incidents?qrHandoff=1')
    expect(container.textContent).toContain('Redirecting to the correct incident workflow...')
    expect(container.textContent).not.toContain('QR terminal handoff')
    expect(container.querySelector('[data-testid="vehicle-lookup-field"]')).toBeNull()
    expect(sessionStorage.getItem('qr-terminal-handoff')).not.toBeNull()
  })
})