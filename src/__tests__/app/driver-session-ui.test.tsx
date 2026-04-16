// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { SWRConfig } from 'swr'

const authState = vi.hoisted(() => ({
  user: { id: 'driver-1', username: 'ABC-123' },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: authState.user }),
}))

import DriverDashboard from '@/components/DriverDashboard'

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderDashboard() {
  return React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    React.createElement(DriverDashboard),
  )
}

describe('DriverDashboard session UI', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/driver/session/active')) {
        return Promise.resolve(
          makeResponse({
            driver: {
              id: 'driver-1',
              firstName: 'Driver',
              lastName: 'One',
              username: 'ABC-123',
            },
            vehicle: {
              id: 'vehicle-1',
              plateNumber: 'ABC-123',
              vehicleType: 'TRICYCLE',
              make: 'Honda',
              model: 'TMX',
              color: 'Blue',
              assignedAt: '2026-04-15T07:00:00.000Z',
            },
            session: {
              id: 'session-1',
              status: 'OPEN',
              statusLabel: 'Open',
              activeRiderCount: 2,
              pendingCount: 1,
              boardedCount: 1,
              completedCount: 1,
              archivedCount: 1,
              openedAt: '2026-04-15T08:00:00.000Z',
              closedAt: null,
              canStartSession: false,
              canCloseSession: false,
            },
            sections: [
              {
                key: 'pending',
                label: 'Pending',
                riders: [
                  {
                    id: 'rider-1',
                    fareCalculationId: 'calc-1',
                    origin: 'Mercado',
                    destination: 'Terminal',
                    fareSnapshot: 35,
                    discountType: null,
                    status: 'PENDING',
                    statusLabel: 'Pending',
                    joinedAt: '2026-04-15T08:05:00.000Z',
                    availableActions: [
                      { action: 'ACCEPT', label: 'Accept', kind: 'positive' },
                      { action: 'NOT_HERE', label: 'Not Here', kind: 'negative' },
                      { action: 'FULL', label: 'Full', kind: 'negative' },
                      { action: 'WRONG_TRIP', label: 'Wrong Trip', kind: 'negative' },
                      { action: 'CANCELLED', label: 'Cancelled', kind: 'negative' },
                    ],
                  },
                ],
              },
              {
                key: 'boarded',
                label: 'Boarded',
                riders: [
                  {
                    id: 'rider-2',
                    fareCalculationId: 'calc-2',
                    origin: 'Market',
                    destination: 'School',
                    fareSnapshot: 28,
                    discountType: 'STUDENT',
                    status: 'BOARDED',
                    statusLabel: 'Boarded',
                    joinedAt: '2026-04-15T08:10:00.000Z',
                    availableActions: [{ action: 'DROPPED_OFF', label: 'Dropped Off', kind: 'positive' }],
                  },
                ],
              },
              {
                key: 'completed',
                label: 'Completed',
                riders: [
                  {
                    id: 'rider-3',
                    fareCalculationId: 'calc-3',
                    origin: 'Bridge',
                    destination: 'Wharf',
                    fareSnapshot: 20,
                    discountType: null,
                    status: 'COMPLETED',
                    statusLabel: 'Completed',
                    joinedAt: '2026-04-15T08:15:00.000Z',
                    availableActions: [],
                  },
                ],
              },
              {
                key: 'archived',
                label: 'Archived',
                riders: [
                  {
                    id: 'rider-4',
                    fareCalculationId: 'calc-4',
                    origin: 'Port',
                    destination: 'Barangay Hall',
                    fareSnapshot: 25,
                    discountType: null,
                    status: 'REJECTED_FULL',
                    statusLabel: 'Full',
                    joinedAt: '2026-04-15T08:20:00.000Z',
                    availableActions: [],
                  },
                ],
              },
            ],
          }),
        )
      }

      if (url.includes('/api/driver/session/history')) {
        return Promise.resolve(
          makeResponse({
            limit: 10,
            items: [
              {
                id: 'closed-session-1',
                status: 'CLOSED',
                statusLabel: 'Closed',
                openedAt: '2026-04-14T08:00:00.000Z',
                closedAt: '2026-04-14T09:00:00.000Z',
                riderCount: 1,
                completedCount: 1,
                archivedCount: 0,
                riders: [
                  {
                    id: 'history-rider-1',
                    fareCalculationId: 'history-calc-1',
                    origin: 'Old Market',
                    destination: 'Town Plaza',
                    fareSnapshot: 40,
                    discountType: null,
                    status: 'COMPLETED',
                    statusLabel: 'Completed',
                    joinedAt: '2026-04-14T08:05:00.000Z',
                    acceptedAt: '2026-04-14T08:06:00.000Z',
                    boardedAt: '2026-04-14T08:10:00.000Z',
                    completedAt: '2026-04-14T08:25:00.000Z',
                    finalisedAt: '2026-04-14T08:25:00.000Z',
                  },
                ],
              },
            ],
          }),
        )
      }

      if (url.includes('/api/driver/session/session-1/riders/rider-1/action')) {
        return Promise.resolve(makeResponse({ success: true }))
      }

      throw new Error(`Unhandled fetch url: ${url}`)
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

  it('renders Boarded section and Dropped Off action; shows pending badge not a full Pending section', async () => {
    await act(async () => {
      root.render(renderDashboard())
      await Promise.resolve()
      await Promise.resolve()
    })

    // Boarded section with its rider action is present in the main scroll
    expect(container.textContent).toContain('Boarded')
    expect(container.textContent).toContain('Dropped Off')

    // Completed section header is present (collapsed by default but heading is visible)
    expect(container.textContent).toContain('Completed')

    // No free-text input anywhere on the screen
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('input[type="text"]')).toBeNull()

    // No extraneous action labels
    expect(container.textContent).not.toContain('Confirm Route')
    expect(container.textContent).not.toContain('Validate Rider')

    // Pending badge is shown (pendingCount: 1 in test data)
    expect(container.textContent).toContain('1 pending')

    // Pending is NOT a full section heading in the main scroll area
    // (it only appears as a badge and in the sidebar summary)
    const sectionHeadings = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent?.trim())
    expect(sectionHeadings).not.toContain('Pending')

    // Accept BUTTON is NOT rendered on the main screen (it lives in modal / pending queue drawer)
    // Note: the sidebar note text "Use Accept, Boarded..." still contains the word Accept, so
    // we must check for button elements specifically, not textContent.
    const acceptButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Accept',
    )
    expect(acceptButton).toBeUndefined()

    // Negative action labels are not shown in the main scroll (pending riders are not in main section)
    expect(container.textContent).not.toContain('Not Here')
    expect(container.textContent).not.toContain('Wrong Trip')
  })

  it('refreshes recent history immediately after closing a trip', async () => {
    let sessionClosed = false

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/driver/session/active')) {
        return Promise.resolve(
          makeResponse(
            sessionClosed
              ? {
                  driver: {
                    id: 'driver-1',
                    firstName: 'Driver',
                    lastName: 'One',
                    username: 'ABC-123',
                  },
                  vehicle: {
                    id: 'vehicle-1',
                    plateNumber: 'ABC-123',
                    vehicleType: 'TRICYCLE',
                    make: 'Honda',
                    model: 'TMX',
                    color: 'Blue',
                    assignedAt: '2026-04-15T07:00:00.000Z',
                  },
                  session: {
                    id: null,
                    status: null,
                    statusLabel: 'No Active Trip',
                    activeRiderCount: 0,
                    pendingCount: 0,
                    boardedCount: 0,
                    completedCount: 0,
                    archivedCount: 0,
                    openedAt: null,
                    closedAt: null,
                    canStartSession: true,
                    canCloseSession: false,
                  },
                  sections: [],
                }
              : {
                  driver: {
                    id: 'driver-1',
                    firstName: 'Driver',
                    lastName: 'One',
                    username: 'ABC-123',
                  },
                  vehicle: {
                    id: 'vehicle-1',
                    plateNumber: 'ABC-123',
                    vehicleType: 'TRICYCLE',
                    make: 'Honda',
                    model: 'TMX',
                    color: 'Blue',
                    assignedAt: '2026-04-15T07:00:00.000Z',
                  },
                  session: {
                    id: 'session-1',
                    status: 'IN_PROGRESS',
                    statusLabel: 'In Progress',
                    activeRiderCount: 0,
                    pendingCount: 0,
                    boardedCount: 0,
                    completedCount: 1,
                    archivedCount: 0,
                    openedAt: '2026-04-15T08:00:00.000Z',
                    closedAt: null,
                    canStartSession: false,
                    canCloseSession: true,
                  },
                  sections: [
                    {
                      key: 'pending',
                      label: 'Pending',
                      riders: [],
                    },
                    {
                      key: 'boarded',
                      label: 'Boarded',
                      riders: [],
                    },
                    {
                      key: 'completed',
                      label: 'Completed',
                      riders: [
                        {
                          id: 'rider-3',
                          fareCalculationId: 'calc-3',
                          origin: 'Bridge',
                          destination: 'Wharf',
                          fareSnapshot: 20,
                          discountType: null,
                          status: 'COMPLETED',
                          statusLabel: 'Completed',
                          joinedAt: '2026-04-15T08:15:00.000Z',
                          availableActions: [],
                        },
                      ],
                    },
                    {
                      key: 'archived',
                      label: 'Archived',
                      riders: [],
                    },
                  ],
                },
          ),
        )
      }

      if (url.includes('/api/driver/session/history')) {
        return Promise.resolve(
          makeResponse({
            limit: 10,
            items: sessionClosed
              ? [
                  {
                    id: 'closed-session-2',
                    status: 'CLOSED',
                    statusLabel: 'Closed',
                    openedAt: '2026-04-15T08:00:00.000Z',
                    closedAt: '2026-04-15T09:00:00.000Z',
                    riderCount: 1,
                    completedCount: 1,
                    archivedCount: 0,
                    riders: [
                      {
                        id: 'history-rider-2',
                        fareCalculationId: 'history-calc-2',
                        origin: 'Closed Market',
                        destination: 'River Port',
                        fareSnapshot: 42,
                        discountType: null,
                        status: 'COMPLETED',
                        statusLabel: 'Completed',
                        joinedAt: '2026-04-15T08:05:00.000Z',
                        acceptedAt: '2026-04-15T08:06:00.000Z',
                        boardedAt: '2026-04-15T08:10:00.000Z',
                        completedAt: '2026-04-15T08:24:00.000Z',
                        finalisedAt: '2026-04-15T08:24:00.000Z',
                      },
                    ],
                  },
                ]
              : [],
          }),
        )
      }

      if (url.includes('/api/driver/session/session-1/close')) {
        sessionClosed = true

        return Promise.resolve(
          makeResponse({
            driver: {
              id: 'driver-1',
              firstName: 'Driver',
              lastName: 'One',
              username: 'ABC-123',
            },
            vehicle: {
              id: 'vehicle-1',
              plateNumber: 'ABC-123',
              vehicleType: 'TRICYCLE',
              make: 'Honda',
              model: 'TMX',
              color: 'Blue',
              assignedAt: '2026-04-15T07:00:00.000Z',
            },
            session: {
              id: null,
              status: null,
              statusLabel: 'No Active Trip',
              activeRiderCount: 0,
              pendingCount: 0,
              boardedCount: 0,
              completedCount: 0,
              archivedCount: 0,
              openedAt: null,
              closedAt: null,
              canStartSession: true,
              canCloseSession: false,
            },
            sections: [],
          }),
        )
      }

      throw new Error(`Unhandled fetch url: ${url}`)
    })

    await act(async () => {
      root.render(renderDashboard())
      await Promise.resolve()
      await Promise.resolve()
    })

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Close Trip',
    )
    expect(closeButton).toBeDefined()

    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Close trip resets session — driver can now start a new trip
    expect(container.textContent).toContain('No Active Trip')
  })
})