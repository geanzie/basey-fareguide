// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

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

vi.mock('@/components/VehicleLookupField', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'vehicle-lookup' }),
}))

vi.mock('@/components/PermitQrCard', () => ({
  __esModule: true,
  default: ({ permitPlateNumber, qrToken }: { permitPlateNumber: string; qrToken: string }) =>
    React.createElement('div', { 'data-testid': 'permit-qr-card' }, `${permitPlateNumber}:${qrToken}`),
}))

vi.mock('@/components/ResponsiveTable', () => ({
  __esModule: true,
  default: ({ columns, data }: { columns: Array<{ key: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>; data: Array<Record<string, unknown>> }) =>
    React.createElement(
      'div',
      { 'data-testid': 'responsive-table' },
      data.map((row, index) =>
        React.createElement(
          'div',
          { key: String(row.id ?? index) },
          columns.map((column) =>
            React.createElement(
              'div',
              { key: column.key },
              column.render ? column.render(row[column.key], row) : String(row[column.key] ?? ''),
            ),
          ),
        ),
      ),
    ),
  StatusBadge: ({ status }: { status: string }) => React.createElement('span', null, status),
  ActionButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement('button', { type: 'button', onClick }, children),
}))

import PermitManagement from '@/components/PermitManagement'

function makeJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('PermitManagement QR actions', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let alertMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === '/api/permits?page=1&limit=10') {
        return Promise.resolve(
          makeJsonResponse({
            permits: [
              {
                id: 'permit-legacy',
                permitPlateNumber: 'PERM-LEGACY',
                hasQrToken: false,
                qrToken: null,
                qrIssuedAt: null,
                qrIssuedBy: null,
                driverFullName: 'Pedro Santos',
                vehicleType: 'TRICYCLE',
                issuedDate: '2026-01-01T00:00:00.000Z',
                expiryDate: '2027-01-01T00:00:00.000Z',
                status: 'ACTIVE',
                remarks: null,
                vehicle: {
                  id: 'vehicle-1',
                  plateNumber: 'ABC-123',
                  make: 'Honda',
                  model: 'Wave',
                  ownerName: 'Juan Dela Cruz',
                  vehicleType: 'TRICYCLE',
                },
              },
              {
                id: 'permit-existing',
                permitPlateNumber: 'PERM-EXISTING',
                hasQrToken: true,
                qrToken: null,
                qrIssuedAt: '2026-04-10T09:00:00.000Z',
                qrIssuedBy: 'encoder-1',
                driverFullName: 'Maria Santos',
                vehicleType: 'TRICYCLE',
                issuedDate: '2026-01-01T00:00:00.000Z',
                expiryDate: '2027-01-01T00:00:00.000Z',
                status: 'ACTIVE',
                remarks: null,
                vehicle: {
                  id: 'vehicle-2',
                  plateNumber: 'XYZ-789',
                  make: 'Honda',
                  model: 'TMX',
                  ownerName: 'Maria Santos',
                  vehicleType: 'TRICYCLE',
                },
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 2,
              totalPages: 1,
            },
          }),
        )
      }

      if (url === '/api/permits/permit-existing/qr' && !init?.method) {
        return Promise.resolve(
          makeJsonResponse({
            permit: {
              id: 'permit-existing',
              permitPlateNumber: 'PERM-EXISTING',
              hasQrToken: true,
              qrToken: 'existing-qr-token',
              qrIssuedAt: '2026-04-10T09:00:00.000Z',
              qrIssuedBy: 'encoder-1',
              driverFullName: 'Maria Santos',
              vehicleType: 'TRICYCLE',
              issuedDate: '2026-01-01T00:00:00.000Z',
              expiryDate: '2027-01-01T00:00:00.000Z',
              status: 'ACTIVE',
              remarks: null,
              vehicle: {
                id: 'vehicle-2',
                plateNumber: 'XYZ-789',
                make: 'Honda',
                model: 'TMX',
                ownerName: 'Maria Santos',
                vehicleType: 'TRICYCLE',
              },
            },
          }),
        )
      }

      if (url === '/api/permits/permit-legacy/qr' && init?.method === 'POST') {
        return Promise.resolve(
          makeJsonResponse({
            action: 'issued',
            permit: {
              id: 'permit-legacy',
              permitPlateNumber: 'PERM-LEGACY',
              hasQrToken: true,
              qrToken: 'issued-qr-token',
              qrIssuedAt: '2026-04-12T09:00:00.000Z',
              qrIssuedBy: 'encoder-1',
              driverFullName: 'Pedro Santos',
              vehicleType: 'TRICYCLE',
              issuedDate: '2026-01-01T00:00:00.000Z',
              expiryDate: '2027-01-01T00:00:00.000Z',
              status: 'ACTIVE',
              remarks: null,
              vehicle: {
                id: 'vehicle-1',
                plateNumber: 'ABC-123',
                make: 'Honda',
                model: 'Wave',
                ownerName: 'Juan Dela Cruz',
                vehicleType: 'TRICYCLE',
              },
            },
          }),
        )
      }

      throw new Error(`Unhandled fetch URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
    alertMock = vi.fn()
    vi.stubGlobal('alert', alertMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })

    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('issues a QR token for a legacy permit from the existing permit management workflow', async () => {
    await act(async () => {
      root.render(React.createElement(PermitManagement))
      await Promise.resolve()
      await Promise.resolve()
    })

    const issueButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Issue QR'),
    )

    expect(issueButton).toBeTruthy()

    await act(async () => {
      issueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/permits/permit-legacy/qr', expect.objectContaining({ method: 'POST' }))
    expect(container.textContent).toContain('PERM-LEGACY:issued-qr-token')
    expect(alertMock).toHaveBeenCalledWith('QR token issued for permit PERM-LEGACY')
  })

  it('loads QR details from the dedicated permit QR endpoint instead of relying on list payloads', async () => {
    await act(async () => {
      root.render(React.createElement(PermitManagement))
      await Promise.resolve()
      await Promise.resolve()
    })

    const viewButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('View QR'),
    )

    expect(viewButton).toBeTruthy()

    await act(async () => {
      viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/permits/permit-existing/qr')
    expect(container.textContent).toContain('PERM-EXISTING:existing-qr-token')
  })
})