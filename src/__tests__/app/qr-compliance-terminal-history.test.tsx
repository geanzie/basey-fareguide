// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const scannerState = vi.hoisted(() => ({
  clear: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'enforcer-1',
      userType: 'ENFORCER',
    },
    status: 'authenticated',
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/components/dashboardIcons', () => ({
  DASHBOARD_ICONS: {
    camera: 'camera',
    close: 'close',
    history: 'history',
  },
  DASHBOARD_ICON_POLICY: {
    sizes: {
      button: 16,
      section: 20,
    },
  },
  DashboardIconSlot: () => React.createElement('span', { 'data-testid': 'dashboard-icon' }),
  getDashboardIconChipClasses: () => 'icon-chip',
}))

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = false

    start = scannerState.start
    stop = scannerState.stop
    clear = scannerState.clear
  },
}))

import QrComplianceTerminal from '@/components/QrComplianceTerminal'

function makeJsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function getTerminalShell(container: HTMLDivElement) {
  return container.querySelector('.app-surface-overlay') as HTMLDivElement | null
}

describe('QrComplianceTerminal history', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    scannerState.clear.mockReset()
    scannerState.start.mockReset()
    scannerState.stop.mockReset()
    scannerState.start.mockResolvedValue(undefined)
    scannerState.stop.mockImplementation(() => {
      throw new Error('Cannot stop, scanner is not running or paused.')
    })

    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
      },
    })

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === '/api/terminal/unlock') {
        return Promise.resolve(makeJsonResponse({
          unlocked: true,
          expiresAt: '2026-04-12T10:30:00.000Z',
          lastActivityAt: '2026-04-12T10:00:00.000Z',
          message: 'QR terminal unlocked.',
        }))
      }

      if (url === '/api/terminal/history?limit=8') {
        return Promise.resolve(makeJsonResponse({
          items: [
            {
              id: 'audit-1',
              scannedAt: '2026-04-12T10:00:00.000Z',
              submittedToken: 'qr-token-1',
              resultType: 'MATCHED',
              scanSource: 'CAMERA',
              disposition: 'CLEAR',
              matchedPermitId: 'permit-1',
              permitPlateNumber: 'PERM-100',
              vehiclePlateNumber: 'ABC-123',
            },
          ],
        }, {
          headers: {
            'X-Terminal-Unlock-Expires-At': '2026-04-12T10:35:00.000Z',
          },
        }))
      }

      throw new Error(`Unhandled fetch URL: ${url}`)
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

  it('shows recent scan history after the enforcer unlocks the terminal', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null
    expect(openButton).not.toBeNull()

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )
    expect(unlockButton).toBeTruthy()

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/terminal/history?limit=8')

    const showHistoryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show History'),
    )

    expect(showHistoryButton).toBeTruthy()

    await act(async () => {
      showHistoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(scannerState.clear).toHaveBeenCalled()
    expect(container.textContent).toContain('Recent Scan History')
    expect(container.textContent).toContain('ABC-123')
    expect(container.textContent).toContain('qr-token-1')
    expect(container.textContent).not.toContain('Point the camera at a permit QR.')
    expect(scannerState.start).toHaveBeenCalledTimes(1)

    const refreshButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Refresh'),
    )

    expect(refreshButton).toBeTruthy()

    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(scannerState.start).toHaveBeenCalledTimes(1)
  })

  it('keeps compact height for password and camera states and expands for history', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const initialShell = getTerminalShell(container)
    expect(initialShell).not.toBeNull()
    expect(initialShell?.className).toContain('max-h-[calc(100dvh-1rem)]')
    expect(initialShell?.className).toContain('overflow-y-auto')

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const cameraShell = getTerminalShell(container)
    expect(cameraShell?.className).toContain('max-h-[calc(100dvh-1rem)]')
    expect(cameraShell?.className).toContain('overflow-y-auto')

    const showHistoryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label') === 'Show History',
    )

    expect(showHistoryButton).toBeTruthy()

    await act(async () => {
      showHistoryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const historyShell = getTerminalShell(container)
    expect(historyShell?.className).toContain('h-[calc(100dvh-1rem)]')
    expect(historyShell?.className).toContain('overflow-hidden')
  })

  it('does not throw during cleanup when the scanner instance exists but is not running', async () => {
    await act(async () => {
      root.render(React.createElement(QrComplianceTerminal))
      await Promise.resolve()
    })

    const openButton = container.querySelector('button[aria-label="Open QR compliance terminal"]') as HTMLButtonElement | null

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const passwordInput = container.querySelector('#terminal-password') as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    await act(async () => {
      setInputValue(passwordInput!, 'correct-password')
      await Promise.resolve()
    })

    const unlockButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Unlock Terminal'),
    )

    await act(async () => {
      unlockButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(scannerState.start).toHaveBeenCalled()

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })

    expect(scannerState.stop).not.toHaveBeenCalled()
    expect(scannerState.clear).toHaveBeenCalled()

    root = createRoot(container)
  })
})