// @vitest-environment jsdom
//
// Focused regression tests for the pending-badge + modal-first driver session refactor.
// Uses a vi.hoisted SWR mock so each test controls session data precisely without SWR
// cache bleeding between tests.
//
// Covers every acceptance criterion from the canonical workflow spec:
//   - Pending is not a full main section
//   - Pending badge shows count and opens the compact queue drawer
//   - Multiple riders arriving in one poll window are all discoverable
//   - Modal dismiss does not destroy rider visibility
//   - Riders can be accepted from the pending queue drawer
//   - Boarded section remains on the main screen
//   - Dropped Off action is available for boarded riders
//   - seenRiderIds logic does not permanently hide unresolved pending riders

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

// SWR mock: vi.hoisted ensures this is ready before any downstream imports.
// swrState.data controls what useSWR returns in each test.
const swrState = vi.hoisted(() => ({
  data: undefined as unknown,
  mutate: vi.fn(),
}))

vi.mock('swr', () => ({
  default: () => ({ data: swrState.data, isLoading: false, mutate: swrState.mutate }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'driver-1', username: 'ABC-123' } }),
}))

vi.mock('@/components/PermitQrCard', () => ({
  __esModule: true,
  default: () => null,
}))

import DriverDashboard from '@/components/DriverDashboard'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: {
  pendingRiders?: unknown[]
  boardedRiders?: unknown[]
  pendingCount?: number
  boardedCount?: number
} = {}) {
  const pendingRiders = overrides.pendingRiders ?? []
  const boardedRiders = overrides.boardedRiders ?? []
  return {
    driver: { id: 'driver-1', firstName: 'Driver', lastName: 'One', username: 'ABC-123' },
    vehicle: {
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      make: 'Honda',
      model: 'TMX',
      color: 'Blue',
      assignedAt: '2026-04-16T07:00:00.000Z',
    },
    session: {
      id: 'session-1',
      status: 'IN_PROGRESS',
      statusLabel: 'In Progress',
      activeRiderCount: pendingRiders.length + boardedRiders.length,
      pendingCount: overrides.pendingCount ?? pendingRiders.length,
      boardedCount: overrides.boardedCount ?? boardedRiders.length,
      completedCount: 0,
      archivedCount: 0,
      openedAt: '2026-04-16T08:00:00.000Z',
      closedAt: null,
      canStartSession: false,
      canCloseSession: false,
    },
    sections: [
      { key: 'pending', label: 'Pending', riders: pendingRiders },
      { key: 'boarded', label: 'Boarded', riders: boardedRiders },
      { key: 'completed', label: 'Completed', riders: [] },
      { key: 'archived', label: 'Archived', riders: [] },
    ],
  }
}

function makePendingRider(id: string, origin = 'Market', destination = 'Terminal') {
  return {
    id,
    fareCalculationId: `fc-${id}`,
    origin,
    destination,
    fareSnapshot: 35,
    discountType: null,
    status: 'PENDING',
    statusLabel: 'Pending',
    joinedAt: '2026-04-16T08:05:00.000Z',
    availableActions: [{ action: 'ACCEPT', label: 'Accept', kind: 'positive' }],
  }
}

function makeBoardedRider(id: string) {
  return {
    id,
    fareCalculationId: `fc-${id}`,
    origin: 'Market',
    destination: 'School',
    fareSnapshot: 28,
    discountType: null,
    status: 'BOARDED',
    statusLabel: 'Boarded',
    joinedAt: '2026-04-16T08:10:00.000Z',
    availableActions: [{ action: 'DROPPED_OFF', label: 'Dropped Off', kind: 'positive' }],
  }
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Driver dashboard — pending badge + modal-first refactor', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  /** Render/re-render the component and flush all microtasks. */
  async function mount() {
    await act(async () => {
      root.render(React.createElement(DriverDashboard))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  /**
   * Simulate a new poll result: update swrState.data and re-render so the
   * component calls useSWR() again with a different data reference, triggering
   * the useEffect detection logic exactly as a real SWR poll cycle would.
   */
  async function pushPollUpdate(newData: unknown) {
    swrState.data = newData
    await act(async () => {
      root.render(React.createElement(DriverDashboard))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  function clickButton(label: string) {
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().includes(label),
    )
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return btn
  }

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    swrState.mutate.mockReset()

    // Default fetch: handles rider action endpoint only (SWR session polling is mocked)
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      if (url.includes('/api/driver/session/session-1/riders/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    swrState.data = undefined
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  // ── 1. Pending badge renders when pendingCount > 0 ─────────────────────────

  it('renders a pending badge when pendingCount > 0', async () => {
    swrState.data = makeSession({ pendingRiders: [makePendingRider('r1')], pendingCount: 1 })
    await mount()

    expect(container.textContent).toContain('1 pending')
  })

  // ── 2. Pending badge absent when pendingCount === 0 ────────────────────────

  it('does not render a pending badge button when pendingCount is 0', async () => {
    swrState.data = makeSession({ pendingRiders: [], pendingCount: 0 })
    await mount()

    // The badge is a <button> — check no button has "pending" in its text
    const pendingBadge = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().includes('pending'),
    )
    expect(pendingBadge).toBeUndefined()
  })

  // ── 3. Badge tap opens pending queue drawer ────────────────────────────────

  it('opens the pending queue drawer when the pending badge is tapped', async () => {
    swrState.data = makeSession({ pendingRiders: [makePendingRider('r1')], pendingCount: 1 })
    await mount()

    expect(container.textContent).not.toContain('Pending requests')

    await act(async () => {
      clickButton('pending')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Pending requests')
  })

  // ── 4. Pending section NOT rendered as a full section in main scroll ───────

  it('does not render a full Pending section in the main scroll area', async () => {
    swrState.data = makeSession({
      pendingRiders: [makePendingRider('r1')],
      boardedRiders: [makeBoardedRider('r2')],
    })
    await mount()

    const sectionHeadings = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent?.trim())
    expect(sectionHeadings).not.toContain('Pending')
  })

  // ── 5. Boarded section IS rendered on the main screen ─────────────────────

  it('renders the Boarded section on the main screen', async () => {
    swrState.data = makeSession({ boardedRiders: [makeBoardedRider('r2')] })
    await mount()

    const sectionHeadings = Array.from(container.querySelectorAll('h3')).map((el) => el.textContent?.trim())
    expect(sectionHeadings).toContain('Boarded')
  })

  // ── 6. Dropped Off action available for boarded riders ────────────────────

  it('renders a Dropped Off button for boarded riders', async () => {
    swrState.data = makeSession({ boardedRiders: [makeBoardedRider('r2')] })
    await mount()

    const droppedOffButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Dropped Off',
    )
    expect(droppedOffButton).toBeTruthy()
  })

  // ── 7. Pending rider can be accepted from the queue drawer ────────────────

  it('calls the accept endpoint when a rider is accepted from the pending queue drawer', async () => {
    swrState.data = makeSession({ pendingRiders: [makePendingRider('r1')], pendingCount: 1 })
    await mount()

    // Open drawer via badge
    await act(async () => {
      clickButton('pending')
      await Promise.resolve()
    })

    // Accept from drawer
    await act(async () => {
      clickButton('Accept')
      await Promise.resolve()
      await Promise.resolve()
    })

    const acceptCall = fetchMock.mock.calls.find((args) =>
      typeof args[0] === 'string' && (args[0] as string).includes('/riders/r1/action'),
    )
    expect(acceptCall).toBeTruthy()
    const body = JSON.parse((acceptCall as [string, RequestInit])[1]?.body as string)
    expect(body.action).toBe('ACCEPT')
  })

  // ── 8. seenRiderIds does not hide unresolved rider from the queue drawer ───

  it('keeps a seen/initial-load pending rider visible in the queue drawer', async () => {
    // rider-1 is present on the FIRST render → isInitialLoad seeds it into seenRiderIds
    // without showing the modal, mirroring the page-load scenario.
    // The rider must still appear in the pending queue drawer after badge tap.
    swrState.data = makeSession({
      pendingRiders: [makePendingRider('r1', 'Harbor', 'Basey Town')],
      pendingCount: 1,
    })
    await mount()

    // Modal must NOT have fired (initial-load path seeds without queuing)
    expect(container.textContent).not.toContain('New ride request')

    // Badge must show the rider is still pending
    expect(container.textContent).toContain('1 pending')

    // Opening the drawer must still list the rider by its location
    await act(async () => {
      clickButton('pending')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Pending requests')
    expect(container.textContent).toContain('Harbor')
    expect(container.textContent).toContain('Basey Town')
  })

  // ── 9. Multiple riders in one poll window: both queued for modal ───────────

  it('queues all new riders from a single poll window into the modal sequence', async () => {
    // Initial render: no pending riders → isInitialLoad seeds nothing, sets false
    swrState.data = makeSession({ pendingRiders: [], pendingCount: 0 })
    await mount()

    // Simulate next poll: two new riders arrive simultaneously
    await pushPollUpdate(
      makeSession({
        pendingRiders: [makePendingRider('r1', 'Harbor', 'Town'), makePendingRider('r2', 'Market', 'Church')],
        pendingCount: 2,
      }),
    )

    // Modal fires for first rider
    expect(container.textContent).toContain('New ride request')
    // "+1 more" confirms the second rider is queued behind the first
    expect(container.textContent).toContain('+1 more')
  })

  // ── 10. Modal dismiss does not permanently hide the pending rider ──────────

  it('keeps the pending rider discoverable via badge after the driver dismisses the modal', async () => {
    // Initial render: no pending riders (seeds nothing, isInitialLoad → false)
    swrState.data = makeSession({ pendingRiders: [], pendingCount: 0 })
    await mount()

    // Simulate next poll: one new pending rider
    await pushPollUpdate(
      makeSession({
        pendingRiders: [makePendingRider('r1', 'Harbor', 'Town')],
        pendingCount: 1,
      }),
    )

    // Modal is up
    expect(container.textContent).toContain('New ride request')

    // Driver dismisses modal
    await act(async () => {
      clickButton('Dismiss')
      await Promise.resolve()
    })

    // Modal gone
    expect(container.textContent).not.toContain('New ride request')

    // Badge still shows 1 pending (server data unchanged — rider is not resolved)
    expect(container.textContent).toContain('1 pending')

    // Rider is still recoverable via badge → drawer
    await act(async () => {
      clickButton('pending')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Pending requests')
    expect(container.textContent).toContain('Harbor')
  })
})
