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

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

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
      mutate: vi.fn(),
    } as never)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('keeps workflow actions text-visible while rendering icon-supported controls', async () => {
    await act(async () => {
      root.render(React.createElement(EnforcerIncidentsList))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Enforcer Incident Queue')
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
})
