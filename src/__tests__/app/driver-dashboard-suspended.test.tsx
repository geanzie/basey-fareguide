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

describe('DriverDashboard when the vehicle type is suspended', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/driver/session/active')) {
        return Promise.resolve(
          makeResponse(
            {
              message:
                'Trip acceptance is suspended for this vehicle type. Riders record their own trips by scanning the permit QR on the vehicle.',
              code: 'DRIVER_SESSION_SUSPENDED',
            },
            409,
          ),
        )
      }

      return Promise.resolve(makeResponse({}, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      root.render(renderDashboard())
    })
    await act(async () => {
      await Promise.resolve()
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('explains the suspension instead of showing an error', () => {
    expect(container.textContent).toContain('Accepting trips is suspended')
    expect(container.textContent).toContain('scans it and records the trip themselves')
  })

  it('hides the online/offline controls and the rider queue', () => {
    const buttonLabels = Array.from(container.querySelectorAll('button')).map(
      (button) => button.textContent ?? '',
    )

    expect(buttonLabels.some((label) => label.includes('Start Trip'))).toBe(false)
    expect(buttonLabels.some((label) => label.includes('Close Trip'))).toBe(false)
    expect(buttonLabels.some((label) => label.includes('Accept'))).toBe(false)
    expect(container.textContent).not.toContain('Try Again')
  })

  it('keeps the permit QR available for a damaged sticker', () => {
    expect(container.querySelector('[aria-label="View my permit QR"]')).not.toBeNull()
  })

  it('keeps history and incidents reachable', () => {
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))

    expect(hrefs).toContain('/driver/history')
    expect(hrefs).toContain('/driver/incidents')
  })
})
