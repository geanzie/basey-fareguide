// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import AdminRoutingSettingsManager from '@/components/AdminRoutingSettingsManager'

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AdminRoutingSettingsManager', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (!url.includes('/api/admin/settings/routing')) {
        throw new Error(`Unhandled fetch url: ${url}`)
      }

      if (init?.method === 'PATCH') {
        return Promise.resolve(
          makeJsonResponse({
            success: true,
            changed: true,
            message: 'Routing provider setting saved successfully.',
            settings: {
              primaryProvider: 'google_routes',
              fallbackProvider: 'ors',
              fallbackEnabled: true,
              fallbackDescription: 'Automatic fallback to the other provider is enabled.',
              cacheInvalidationNote:
                'Changes apply to new route calculations. Cached routes from the previous provider are invalidated.',
              source: 'database',
              lastUpdatedById: 'admin-1',
              lastUpdatedByName: 'Admin User (@admin)',
              lastUpdatedAt: '2026-04-10T01:00:00.000Z',
              warning: null,
            },
          }),
        )
      }

      return Promise.resolve(
        makeJsonResponse({
          primaryProvider: 'ors',
          fallbackProvider: 'google_routes',
          fallbackEnabled: true,
          fallbackDescription: 'Automatic fallback to the other provider is enabled.',
          cacheInvalidationNote:
            'Changes apply to new route calculations. Cached routes from the previous provider are invalidated.',
          source: 'database',
          lastUpdatedById: 'admin-1',
          lastUpdatedByName: 'Admin User (@admin)',
          lastUpdatedAt: '2026-04-10T00:00:00.000Z',
          warning: null,
        }),
      )
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

  it('renders metadata and saves the selected provider explicitly', async () => {
    await act(async () => {
      root.render(React.createElement(AdminRoutingSettingsManager))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Primary routing provider')
    expect(container.textContent).toContain('Admin User (@admin)')
    expect(container.textContent).toContain('Automatic fallback to the other provider is enabled.')
    expect(container.textContent).toContain('Cached routes from the previous provider are invalidated.')

    const googleRadio = container.querySelector('input[value="google_routes"]') as HTMLInputElement | null
    const form = container.querySelector('form')

    expect(googleRadio).not.toBeNull()
    expect(form).not.toBeNull()

    await act(async () => {
      googleRadio?.click()
    })

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/settings/routing',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ primaryProvider: 'google_routes' }),
      }),
    )
    expect(container.textContent).toContain('Routing provider setting saved successfully.')
    expect(container.textContent).toContain('Google Routes')
  })
})