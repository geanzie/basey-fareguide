// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import useSWR from 'swr'

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
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

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mutateMock = vi.fn(() => Promise.resolve())
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
              message: 'Ticket T-202 issued successfully. Incident marked as resolved and evidence cleanup initiated.',
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
            reportedBy: {
              firstName: 'Juan',
              lastName: 'Dela Cruz',
            },
          },
          {
            id: 'incident-2',
            status: 'INVESTIGATING',
            statusLabel: 'Investigating',
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
            reportedBy: {
              firstName: 'Maria',
              lastName: 'Santos',
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
      root.render(React.createElement(EnforcerIncidentsList))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Queue overview')
    expect(container.textContent).toContain('Search incidents')
    expect(container.textContent).toContain('View Details')
    expect(container.textContent).toContain('Evidence')
    expect(container.textContent).toContain('Take and Issue Ticket')
    expect(container.textContent).toContain('Issue Ticket')
    expect(container.textContent).toContain('Resolve Only')

    const controls = Array.from(container.querySelectorAll('button'))

    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every((button) => (button.textContent || '').trim().length > 0)).toBe(true)
  })

  it('renders the enforced penalty preview as read-only in the ticket modal', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList))
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
      root.render(React.createElement(EnforcerIncidentsList))
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
    expect(container.textContent).toContain('Ticket issued')
    expect(container.textContent).toContain('Ticket T-202 issued successfully. Incident marked as resolved and evidence cleanup initiated.')
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    expect(vi.mocked(globalThis.alert)).not.toHaveBeenCalled()
  })
})
