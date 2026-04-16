// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import type { RoutePlannerMapProps } from '@/components/RoutePlannerMap'

const authState = vi.hoisted(() => ({
  user: { id: 'public-1' } as { id: string } | null,
  status: 'authenticated' as 'authenticated' | 'unauthenticated',
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: authState.user, status: authState.status }),
}))

vi.mock('@/components/PublicRideTagScanner', () => ({
  __esModule: true,
  default: ({ onUseVehicle }: { onUseVehicle: (vehicle: Record<string, unknown>) => void }) =>
    React.createElement(
      'button',
      {
        onClick: () =>
          onUseVehicle({
            id: 'vehicle-qr-1',
            plateNumber: 'ABC-123',
            permitPlateNumber: 'BP-1001',
            vehicleType: 'TRICYCLE',
            make: 'Honda',
            model: 'TMX',
            color: 'Blue',
            ownerName: null,
            driverName: 'Driver Name',
            driverLicense: null,
          }),
      },
      'Mock confirm scanned vehicle',
    ),
}))

import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'

function MockPlannerMap(props: RoutePlannerMapProps) {
  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      { onClick: () => props.onOriginChange({ lat: 11.2754, lng: 125.0689, label: 'Mercado' }) },
      'Mock place A',
    ),
    React.createElement(
      'button',
      { onClick: () => props.onDestinationChange({ lat: 11.2854, lng: 125.0789, label: 'Amandayehan Wharf' }) },
      'Mock place B',
    ),
    React.createElement('div', null, `state:${props.plannerState}`),
  )
}

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('RoutePlannerCalculator QR tagging integration', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let savedCalculationBodies: Array<unknown>

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    savedCalculationBodies = []

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/routes/calculate')) {
        return Promise.resolve(
          makeResponse({
            origin: 'Mercado',
            destination: 'Amandayehan Wharf',
            distanceKm: 5.4,
            durationMin: 12,
            fare: 24,
            farePolicy: {
              versionId: 'fare-live',
              baseDistanceKm: 3,
              baseFare: 15,
              perKmRate: 3,
              effectiveAt: '2026-04-01T00:00:00.000Z',
            },
            fareBreakdown: {
              baseFare: 15,
              additionalKm: 2.4,
              additionalFare: 9,
              discount: 0,
            },
            method: 'ors',
            provider: 'ors',
            fallbackReason: null,
            polyline: 'encoded-save',
            inputMode: 'pin',
            isEstimate: false,
          }),
        )
      }

      if (url.includes('/api/discount-cards/me')) {
        return Promise.resolve(
          makeResponse({
            hasDiscountCard: false,
            isValid: false,
            discountCard: null,
          }),
        )
      }

      if (url.includes('/api/fare-calculations')) {
        savedCalculationBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve(makeResponse({ success: true, calculation: { id: 'calc-1' } }))
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
    vi.useRealTimers()
  })

  it('persists the QR-confirmed vehicle identity through the existing fare calculation save payload', async () => {
    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const openScanModeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Scan operator QR'),
    )

    await act(async () => {
      openScanModeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const confirmButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mock confirm scanned vehicle'),
    )

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const placeAButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mock place A'),
    )
    const placeBButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mock place B'),
    )

    await act(async () => {
      placeAButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      placeBButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Send trip request'),
    )

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(savedCalculationBodies).toHaveLength(1)
    expect(savedCalculationBodies[0]).toMatchObject({
      vehicleId: 'vehicle-qr-1',
      fromLocation: 'Mercado',
      toLocation: 'Amandayehan Wharf',
    })
  })
})