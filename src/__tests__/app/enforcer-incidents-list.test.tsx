// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import useSWR, { useSWRConfig } from 'swr'

import { QR_TERMINAL_HANDOFF_STORAGE_KEY, storeQrTerminalHandoff } from '@/lib/terminal/handoff'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'enforcer-1',
      userType: 'ENFORCER',
    },
    status: 'authenticated',
  }),
}))

const searchParamsState = vi.hoisted(() => ({
  qrHandoff: null as string | null,
}))

const searchParamsMock = vi.hoisted(() => ({
  get: (key: string) => (key === 'qrHandoff' ? searchParamsState.qrHandoff : null),
}))

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
  useSWRConfig: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock,
}))

vi.mock('@/components/ResponsiveTable', () => ({
  __esModule: true,
  default: ({
    columns,
    data,
    emptyMessage,
  }: {
    columns: Array<{
      key: string
      render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
    }>
    data: Array<Record<string, unknown>>
    emptyMessage: string
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'responsive-table' },
      data.length === 0
        ? emptyMessage
        : data.map((row) =>
            React.createElement(
              'div',
              { key: String(row.id ?? row.type ?? Math.random()) },
              columns.map((column) =>
                React.createElement(
                  'div',
                  { key: column.key },
                  column.render
                    ? column.render(row[column.key], row)
                    : (row[column.key] as React.ReactNode),
                ),
              ),
            ),
          ),
    ),
  StatusBadge: ({ status, className }: { status: string; className?: string }) =>
    React.createElement('span', { className }, status),
  ActionButton: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode
    className?: string
    onClick: () => void
  }) => React.createElement('button', { className, onClick }, children),
}))

vi.mock('@/components/EvidenceManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'EvidenceManager'),
}))

import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'

describe('EnforcerIncidentsList', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let mutateMock: ReturnType<typeof vi.fn>
  let mutateCacheMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()
    localStorage.clear()
    searchParamsState.qrHandoff = null
    mutateMock = vi.fn(() => Promise.resolve())
    mutateCacheMock = vi.fn(() => Promise.resolve())
    vi.mocked(useSWRConfig).mockReturnValue({
      mutate: mutateCacheMock,
      cache: new Map(),
    } as never)
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = init?.method || 'GET'

      if (url.includes('/api/incidents/incident-2/issue-ticket') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              penalty: {
                offenseNumber: 1,
                offenseTier: 'FIRST',
                offenseTierLabel: '1st offense',
                penaltyAmount: 500,
                currentPenaltyAmount: 500,
                carriedForwardPenaltyAmount: 0,
                priorTicketCount: 0,
                priorUnpaidTicketCount: 0,
                ruleVersion: '2026-04-municipal-v1',
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      if (url.includes('/api/incidents/incident-2/issue-ticket') && method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message:
                'Ticket T-202 issued. Awaiting confirmed full payment before the incident is marked as resolved. Evidence remains available for 30 days.',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('alert', vi.fn())

    vi.mocked(useSWR).mockReturnValue({
      data: {
        incidents: [
          {
            id: 'incident-1',
            status: 'PENDING',
            statusLabel: 'Pending',
            type: 'OVERCHARGING',
            typeLabel: 'Overcharging',
            location: 'Basey Public Market',
            date: '2026-04-03T08:00:00.000Z',
            createdAt: '2026-04-03T08:30:00.000Z',
            description: 'Passenger reported overcharging.',
            plateNumber: 'ABC-123',
            driverLicense: 'D-12345',
            ticketNumber: null,
            paymentStatus: null,
            paidAt: null,
            penaltyAmount: null,
            handledById: null,
            reportedBy: {
              firstName: 'Juan',
              lastName: 'Dela Cruz',
            },
          },
          {
            id: 'incident-2',
            status: 'PENDING',
            statusLabel: 'Pending',
            type: 'RECKLESS_DRIVING',
            typeLabel: 'Reckless Driving',
            location: 'Barangay Tinago',
            date: '2026-04-02T11:00:00.000Z',
            createdAt: '2026-04-02T11:10:00.000Z',
            description: 'Follow-up review in progress.',
            plateNumber: 'XYZ-789',
            driverLicense: 'D-67890',
            ticketNumber: null,
            paymentStatus: null,
            paidAt: null,
            penaltyAmount: 500,
            handledById: null,
            evidenceVerifiedAt: '2026-04-02T10:50:00.000Z',
            evidenceVerifiedBy: { firstName: 'Pedro', lastName: 'Reyes', fullName: 'Pedro Reyes' },
            reportedBy: {
              firstName: 'Maria',
              lastName: 'Santos',
            },
          },
          {
            id: 'incident-3',
            status: 'RESOLVED',
            statusLabel: 'Resolved',
            type: 'OTHER',
            typeLabel: 'Other',
            location: 'Basey Terminal',
            date: '2026-03-28T09:00:00.000Z',
            createdAt: '2026-03-28T09:15:00.000Z',
            description: 'Resolved ticket archived for reporting.',
            plateNumber: 'RES-321',
            driverLicense: 'D-24680',
            ticketNumber: 'T-099',
            paymentStatus: 'PAID',
            paidAt: '2026-03-30T10:00:00.000Z',
            penaltyAmount: 750,
            handledById: 'enforcer-2',
            reportedBy: {
              firstName: 'Carlos',
              lastName: 'Reyes',
            },
          },
          {
            id: 'incident-4',
            status: 'DISMISSED',
            statusLabel: 'Dismissed',
            type: 'OTHER',
            typeLabel: 'Other',
            location: 'Old Municipal Hall',
            date: '2026-03-20T08:00:00.000Z',
            createdAt: '2026-03-20T08:10:00.000Z',
            description: 'Dismissed after duplicate report review.',
            plateNumber: 'DIS-654',
            driverLicense: 'D-13579',
            ticketNumber: null,
            paymentStatus: null,
            paidAt: null,
            penaltyAmount: null,
            handledById: null,
            reportedBy: {
              firstName: 'Andrea',
              lastName: 'Lopez',
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      mutate: mutateMock,
    } as never)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('keeps workflow actions text-visible while rendering icon-supported controls', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'dashboard' }))
      await Promise.resolve()
    })

    expect(vi.mocked(useSWR)).toHaveBeenCalledWith('/api/incidents/enforcer?scope=all&mode=dashboard')
    expect(container.textContent).toContain('Queue overview')
    expect(container.textContent).toContain('Search incidents')
    expect(container.textContent).toContain('4 incidents returned')
    expect(container.textContent).toContain('View Details')
    expect(container.textContent).toContain('Evidence')
    expect(container.textContent).not.toContain('Verify Evidence')
    expect(container.textContent).toContain('Issue Ticket')
    expect(container.textContent).not.toContain('Dismiss')
    expect(container.textContent).not.toContain('Take and Issue Ticket')
    expect(container.textContent).not.toContain('Resolve Only')

    const controls = Array.from(container.querySelectorAll('button'))

    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every((button) => (button.textContent || '').trim().length > 0)).toBe(true)
  })

  it('shows evidence management for all enforcers without requiring assignment', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'dashboard' }))
      await Promise.resolve()
    })

    const viewDetailButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => (button.textContent || '').trim() === 'View Details',
    )

    expect(viewDetailButtons.length).toBeGreaterThan(0)

    await act(async () => {
      viewDetailButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Manage Evidence')
    expect(container.textContent).not.toContain('Evidence is only accessible to the enforcer or admin.')
  })

  it('renders incident details in a compact case snapshot layout', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'dashboard' }))
      await Promise.resolve()
    })

    const viewDetailButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => (button.textContent || '').trim() === 'View Details',
    )

    await act(async () => {
      viewDetailButtons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Incident Details')
    expect(container.textContent).toContain('Case Snapshot')
    expect(container.textContent).toContain('Type')
    expect(container.textContent).toContain('Reporter')
    expect(container.textContent).toContain('Penalty')
    expect(container.textContent).toContain('Manage Evidence')
  })

  it('renders the enforced penalty preview as read-only in the ticket modal', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'dashboard' }))
      await Promise.resolve()
    })

    const issueTicketButton = Array.from(container.querySelectorAll('button')).find(
      (button) => (button.textContent || '').trim() === 'Issue Ticket',
    )

    expect(issueTicketButton).toBeTruthy()

    await act(async () => {
      issueTicketButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/incidents/incident-2/issue-ticket')
    expect(container.textContent).toContain('Enforced Penalty')
    expect(container.textContent).toContain('1st offense')
    expect(container.textContent).toContain('Current Ticket')
    expect(container.textContent).toContain('Amount Due')
    expect(container.textContent).toContain('PHP 500')

    const penaltyInput = Array.from(container.querySelectorAll('input')).find((input) => {
      const placeholder = input.getAttribute('placeholder') || ''
      return placeholder.includes('penalty amount')
    })

    expect(penaltyInput).toBeUndefined()
  })

  it('shows a polished in-app success notice instead of a browser alert after issuing a ticket', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'dashboard' }))
      await Promise.resolve()
    })

    const issueTicketButton = Array.from(container.querySelectorAll('button')).find(
      (button) => (button.textContent || '').trim() === 'Issue Ticket',
    )

    expect(issueTicketButton).toBeTruthy()

    await act(async () => {
      issueTicketButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const ticketNumberInput = container.querySelector('input[placeholder="Enter ticket number"]') as HTMLInputElement | null
    expect(ticketNumberInput).not.toBeNull()

    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      descriptor?.set?.call(ticketNumberInput, 'T-202')
      ticketNumberInput?.dispatchEvent(new Event('input', { bubbles: true }))
      ticketNumberInput?.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    const issueButtons = Array.from(container.querySelectorAll('button')).filter(
      (button) => (button.textContent || '').trim() === 'Issue Ticket',
    )
    const submitButton = issueButtons.at(-1)

    expect(submitButton).toBeTruthy()

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/incidents/incident-2/issue-ticket',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(mutateMock).toHaveBeenCalled()
    expect(mutateCacheMock).toHaveBeenCalledWith('/api/incidents/enforcer?scope=all&mode=dashboard')
    expect(mutateCacheMock).toHaveBeenCalledWith('/api/incidents/enforcer?scope=unresolved&mode=queue')
    expect(container.textContent).toContain('Ticket issued')
    expect(container.textContent).toContain(
      'Ticket T-202 issued. Awaiting confirmed full payment before the incident is marked as resolved. Evidence remains available for 30 days.',
    )
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    expect(vi.mocked(globalThis.alert)).not.toHaveBeenCalled()
  })

  it('keeps queue mode operational and unresolved-only', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'queue' }))
      await Promise.resolve()
    })

    expect(vi.mocked(useSWR)).toHaveBeenCalledWith('/api/incidents/enforcer?scope=unresolved&mode=queue')
    expect(container.textContent).toContain('Unresolved work queue')
    expect(container.textContent).toContain('2 incidents returned')
    expect(container.textContent).not.toContain('Queue overview')
    expect(container.textContent).not.toContain('Total Incidents')
    expect(container.textContent).not.toContain('Include resolved incidents from:')
    expect(container.textContent).not.toContain('Resolved ticket archived for reporting.')
    expect(container.textContent).not.toContain('Dismissed after duplicate report review.')

    const buttons = Array.from(container.querySelectorAll('button')).map((button) => (button.textContent || '').trim())

    expect(buttons).not.toContain('Resolved (1)')
    expect(buttons).toContain('All (2)')
    expect(buttons).toContain('Pending (2)')
    expect(buttons).toContain('Ticket Issued (0)')
  })

  it('loads the QR handoff snapshot into the enforcer queue banner', async () => {
    searchParamsState.qrHandoff = '1'
    sessionStorage.setItem('qr-terminal-handoff', JSON.stringify({
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
    }))

    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'queue' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('QR Handoff')
    expect(container.textContent).toContain('ABC-123 is loaded into the queue')
    expect(container.textContent).toContain('Permit status: ACTIVE. Compliance: REVIEW REQUIRED.')
    expect(container.textContent).toContain('Driver: Pedro Santos • Unpaid tickets: 1')
  })

  it('restores the queue handoff from durable storage after session storage is cleared', async () => {
    searchParamsState.qrHandoff = '1'
    storeQrTerminalHandoff({
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
    })
    sessionStorage.removeItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)

    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'queue' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('QR Handoff')
    expect(container.textContent).toContain('ABC-123 is loaded into the queue')
    expect(container.textContent).toContain('Driver: Pedro Santos • Unpaid tickets: 1')
    expect(sessionStorage.getItem(QR_TERMINAL_HANDOFF_STORAGE_KEY)).not.toBeNull()
  })

  it('optimizes the embedded terminal queue to the matched plate only', async () => {
    await act(async () => {
      root.render(
        React.createElement(EnforcerIncidentsList, {
          mode: 'queue',
          embeddedQrHandoffSnapshot: {
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
          },
        }),
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Matched incidents for ABC-123')
    expect(container.textContent).toContain('1 unresolved incident matched to this plate number.')
    expect(container.textContent).not.toContain('Unresolved work queue')
    expect(container.textContent).not.toContain('incident awaiting response')
    expect(container.textContent).not.toContain('Search incidents')
    expect(container.textContent).toContain('ABC-123')
    expect(container.textContent).not.toContain('XYZ-789')
  })

  it('shows an explicit notice when queue handoff data is missing vehicle context', async () => {
    searchParamsState.qrHandoff = '1'
    sessionStorage.setItem('qr-terminal-handoff', JSON.stringify({
      permitId: 'permit-1',
      vehicleId: null,
      operatorId: null,
      scannedTokenFingerprint: 'sha256:demo-token-fingerprint',
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
    }))

    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList, { mode: 'queue' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('QR handoff did not include a vehicle. Re-scan the permit in the QR terminal before opening the queue.')
    expect(container.textContent).not.toContain('is loaded into the queue')
    expect(sessionStorage.getItem('qr-terminal-handoff')).toBeNull()
    expect(localStorage.getItem('qr-terminal-handoff')).toBeNull()
  })
})
