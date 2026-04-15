// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('@/components/QrTokenScannerPanel', () => ({
  __esModule: true,
  default: ({ onDetected }: { onDetected: (token: string) => void }) =>
    React.createElement(
      'button',
      {
        onClick: () => onDetected('qr-token-1'),
      },
      'Mock detect QR',
    ),
}))

import PublicRideTagScanner from '@/components/PublicRideTagScanner'

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PublicRideTagScanner', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let useVehicleMock: ReturnType<typeof vi.fn>
  let clearVehicleMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useVehicleMock = vi.fn()
    clearVehicleMock = vi.fn()
    fetchMock = vi.fn(() =>
      Promise.resolve(
        makeJsonResponse({
          scannedToken: 'qr-token-1',
          matchFound: true,
          permitStatus: 'ACTIVE',
          permit: {
            id: 'permit-1',
            permitPlateNumber: 'BP-1001',
            driverFullName: 'Driver Name',
            vehicleType: 'TRICYCLE',
            issuedDate: '2026-01-01T00:00:00.000Z',
            expiryDate: '2027-01-01T00:00:00.000Z',
            qrIssuedAt: '2026-04-12T08:00:00.000Z',
          },
          vehicle: {
            id: 'vehicle-1',
            plateNumber: 'ABC-123',
            permitPlateNumber: 'BP-1001',
            vehicleType: 'TRICYCLE',
            make: 'Honda',
            model: 'TMX',
            color: 'Blue',
            driverName: 'Driver Name',
          },
          message: 'Vehicle identity confirmed. Review it and confirm before saving this trip.',
        }),
      ),
    )
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

  it('auto-starts the scanner and replaces it with the scanned operator details in the same panel', async () => {
    await act(async () => {
      root.render(
        React.createElement(PublicRideTagScanner, {
          selectedVehicle: null,
          onUseVehicle: useVehicleMock,
          onClearVehicle: clearVehicleMock,
          autoStart: true,
        }),
      )
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Open QR scanner')

    const detectButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mock detect QR'),
    )

    await act(async () => {
      detectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/public/ride-tag/lookup',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(container.textContent).not.toContain('Mock detect QR')
    expect(container.textContent).toContain('Vehicle identity confirmed. Review it and confirm before saving this trip.')
    expect(container.textContent).toContain('Use this vehicle')

    const useVehicleButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Use this vehicle'),
    )

    await act(async () => {
      useVehicleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(useVehicleMock).toHaveBeenCalledWith({
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      permitPlateNumber: 'BP-1001',
      vehicleType: 'TRICYCLE',
      make: 'Honda',
      model: 'TMX',
      color: 'Blue',
      ownerName: null,
      driverName: 'Driver Name',
      driverLicense: null,
    })
  })

  it('shows the not-found message and only offers scan again for invalid tokens', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        makeJsonResponse({
          scannedToken: 'missing-token',
          matchFound: false,
          permitStatus: null,
          permit: null,
          vehicle: null,
          message: 'No permit matched the submitted QR token.',
        }),
      ),
    )

    await act(async () => {
      root.render(
        React.createElement(PublicRideTagScanner, {
          selectedVehicle: null,
          onUseVehicle: useVehicleMock,
          onClearVehicle: clearVehicleMock,
        }),
      )
      await Promise.resolve()
    })

    const openScannerButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Open QR scanner'),
    )

    await act(async () => {
      openScannerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const detectButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mock detect QR'),
    )

    await act(async () => {
      detectButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('No permit matched the submitted QR token.')
    expect(container.textContent).not.toContain('Use this vehicle')
    expect(container.textContent).toContain('Scan again')
    expect(useVehicleMock).not.toHaveBeenCalled()
  })
})