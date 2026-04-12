// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const pinLabelResolverMock = vi.hoisted(() => ({
  resolvePinLabel: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'encoder-1',
      userType: 'DATA_ENCODER',
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}))

vi.mock('@/lib/locations/pinLabelResolver', () => ({
  resolvePinLabel: pinLabelResolverMock.resolvePinLabel,
}))

vi.mock('@/components/ResponsiveTable', () => ({
  __esModule: true,
  default: ({ emptyMessage }: { emptyMessage: string }) =>
    React.createElement('div', { 'data-testid': 'responsive-table' }, emptyMessage),
  StatusBadge: ({ status }: { status: string }) => React.createElement('span', null, status),
  ActionButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => React.createElement('button', { onClick }, children),
}))

import IncidentReporting from '@/components/IncidentReporting'
import PermitManagement from '@/components/PermitManagement'

function makeJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )

  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value',
  )

  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('vehicle loading behavior', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let fareCalculationsPayload: {
    calculations: Array<Record<string, unknown>>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  let geolocationMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fareCalculationsPayload = {
      calculations: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    }

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/fare-calculations')) {
        return Promise.resolve(makeJsonResponse(fareCalculationsPayload))
      }

      if (url.includes('/api/permits')) {
        return Promise.resolve(
          makeJsonResponse({
            permits: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          }),
        )
      }

      if (url.includes('/api/vehicles/options')) {
        return Promise.resolve(
          makeJsonResponse({
            vehicles: [
              {
                id: 'vehicle-1',
                plateNumber: 'ABC-123',
                permitPlateNumber: 'PERMIT-001',
                vehicleType: 'TRICYCLE',
                make: 'Honda',
                model: 'Wave',
                color: 'Blue',
                ownerName: 'Juan Dela Cruz',
                driverName: 'Pedro Santos',
                driverLicense: 'D-12345',
              },
            ],
          }),
        )
      }

      throw new Error(`Unhandled fetch URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    geolocationMock = vi.fn()
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: geolocationMock,
      },
    })

    pinLabelResolverMock.resolvePinLabel.mockReturnValue({
      displayLabel: 'Amandayehan',
      barangayName: 'Amandayehan',
      rawCoordinates: '11.278823, 125.001194',
      isFallback: false,
    })

    sessionStorage.clear()
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

  it('loads trip history on incident report mount without fetching vehicles or geolocation', async () => {
    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/fare-calculations?page=1&limit=10&recentDays=30')
    expect(geolocationMock).not.toHaveBeenCalled()
  })

  it('renders a compact recent-trip picker and uses linked vehicle context from the selected trip', async () => {
    fareCalculationsPayload = {
      calculations: [
        {
          id: 'calc-1',
          from: 'Amandayehan',
          to: 'Anglit',
          distanceKm: 12.5,
          fare: 45,
          actualFare: null,
          originalFare: null,
          discountApplied: null,
          discountType: null,
          calculationType: 'Road Route Planner',
          createdAt: '2026-04-02T09:00:00.000Z',
          routeData: null,
          vehicle: {
            permitPlateNumber: 'PERMIT-001',
            plateNumber: 'ABC-123',
            vehicleType: 'TRICYCLE',
            hasVehicleContext: true,
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    }

    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Select Trip to Report')
    expect(container.textContent).toContain('Recent trips')
    expect(container.querySelector('input[placeholder="Type at least 2 characters to search matching vehicles"]')).toBeNull()
    expect(
      Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('Amandayehan to Anglit')),
    ).toBe(false)

    const tripPicker = container.querySelector('#recentTripPicker') as HTMLSelectElement | null
    expect(tripPicker).not.toBeNull()

    await act(async () => {
      setSelectValue(tripPicker!, 'calc-1')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Amandayehan to Anglit')
    expect(container.querySelector('input[placeholder="Type at least 2 characters to search matching vehicles"]')).toBeNull()
  })

  it('keeps larger trip history inside a single compact recent-trip dropdown', async () => {
    fareCalculationsPayload = {
      calculations: Array.from({ length: 5 }, (_, index) => ({
        id: `calc-${index + 1}`,
        from: `Origin ${index + 1}`,
        to: `Destination ${index + 1}`,
        distanceKm: 10 + index,
        fare: 30 + index,
        actualFare: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
        calculationType: 'Road Route Planner',
        createdAt: `2026-04-0${index + 1}T09:00:00.000Z`,
        routeData: null,
        vehicle: {
          permitPlateNumber: `PERMIT-00${index + 1}`,
          plateNumber: `ABC-12${index + 1}`,
          vehicleType: 'TRICYCLE',
          hasVehicleContext: true,
        },
      })),
      pagination: {
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
      },
    }

    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Recent trips')

    const tripPicker = container.querySelector('#recentTripPicker') as HTMLSelectElement | null
    expect(tripPicker).not.toBeNull()
    expect(tripPicker?.options.length).toBe(6)

    await act(async () => {
      setSelectValue(tripPicker!, 'calc-5')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Origin 5 to Destination 5')
  })

  it('auto-fills the location field when GPS resolves a barangay', async () => {
    geolocationMock.mockImplementationOnce((onSuccess: PositionCallback) => {
      onSuccess({
        coords: {
          latitude: 11.278823,
          longitude: 125.001194,
        },
      } as GeolocationPosition)
    })

    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
    })

    const gpsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Use GPS'),
    )
    const locationSelect = container.querySelector('#location') as HTMLSelectElement | null

    expect(gpsButton).toBeTruthy()
    expect(locationSelect?.value).toBe('')

    await act(async () => {
      gpsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(pinLabelResolverMock.resolvePinLabel).toHaveBeenCalledWith(11.278823, 125.001194)
    expect(locationSelect?.value).toBe('Amandayehan')
    expect(container.textContent).toContain('GPS pinned to Amandayehan')
  })

  it('keeps coordinate fallback as a valid selected location when GPS has no barangay match', async () => {
    pinLabelResolverMock.resolvePinLabel.mockReturnValueOnce({
      displayLabel: '11.500000, 125.500000',
      barangayName: null,
      rawCoordinates: '11.500000, 125.500000',
      isFallback: true,
    })
    geolocationMock.mockImplementationOnce((onSuccess: PositionCallback) => {
      onSuccess({
        coords: {
          latitude: 11.5,
          longitude: 125.5,
        },
      } as GeolocationPosition)
    })

    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
    })

    const gpsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Use GPS'),
    )
    const locationSelect = container.querySelector('#location') as HTMLSelectElement | null

    await act(async () => {
      gpsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(locationSelect?.value).toBe('11.500000, 125.500000')
    expect(Array.from(locationSelect?.options ?? []).some((option) => option.value === '11.500000, 125.500000')).toBe(true)
  })

  it('starts vehicle lookup only after debounce with 2+ characters and fills the selection details', async () => {
    await act(async () => {
      root.render(React.createElement(IncidentReporting))
      await Promise.resolve()
    })

    const searchInput = container.querySelector(
      'input[placeholder="Type at least 2 characters to search matching vehicles"]',
    ) as HTMLInputElement | null

    expect(searchInput).not.toBeNull()

    await act(async () => {
      setInputValue(searchInput!, 'A')
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      setInputValue(searchInput!, 'AB')
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      fetchMock.mock.calls.some(
        ([input]) => String(input).includes('/api/vehicles/options?search=AB'),
      ),
    ).toBe(true)

    const optionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('PERMIT-001'),
    )

    expect(optionButton).toBeTruthy()

    await act(async () => {
      optionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Selected vehicle: PERMIT-001')
    expect(container.textContent).toContain('Plate Number: ABC-123')
    expect(container.textContent).toContain('Owner: Juan Dela Cruz')
  })

  it('does not fetch vehicle options on permit management mount', async () => {
    await act(async () => {
      root.render(React.createElement(PermitManagement))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/permits?page=1&limit=10')
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/vehicles')),
    ).toBe(false)
  })
})
