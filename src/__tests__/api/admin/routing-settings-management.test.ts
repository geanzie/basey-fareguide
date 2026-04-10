import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const routingSettingsMigrationRequiredError = vi.hoisted(
  () =>
    class RoutingSettingsMigrationRequiredError extends Error {
      constructor() {
        super('Routing settings migration required.')
        this.name = 'RoutingSettingsMigrationRequiredError'
      }
    },
)

const routingSettingsServiceMock = vi.hoisted(() => ({
  getAdminRoutingSettings: vi.fn(),
  updateRoutingSettings: vi.fn(),
}))

const routingMock = vi.hoisted(() => ({
  clearRoutingCache: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/routing/settingsService', () => ({
  getAdminRoutingSettings: routingSettingsServiceMock.getAdminRoutingSettings,
  updateRoutingSettings: routingSettingsServiceMock.updateRoutingSettings,
  RoutingSettingsMigrationRequiredError: routingSettingsMigrationRequiredError,
}))

vi.mock('@/lib/routing', () => ({
  clearRoutingCache: routingMock.clearRoutingCache,
}))

import { GET, PATCH } from '@/app/api/admin/settings/routing/route'

function makeJsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body == null ? undefined : JSON.stringify(body),
  })
}

const sampleSettings = {
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
} as const

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('admin routing settings route', () => {
  it('enforces admin authentication for GET', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await GET(makeJsonRequest('http://localhost/api/admin/settings/routing', 'GET') as never)

    expect(response.status).toBe(401)
    expect(routingSettingsServiceMock.getAdminRoutingSettings).not.toHaveBeenCalled()
  })

  it('returns routing settings for admins', async () => {
    routingSettingsServiceMock.getAdminRoutingSettings.mockResolvedValueOnce(sampleSettings)

    const response = await GET(makeJsonRequest('http://localhost/api/admin/settings/routing', 'GET') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.primaryProvider).toBe('ors')
    expect(json.lastUpdatedByName).toBe('Admin User (@admin)')
  })

  it('surfaces migration warnings when settings storage is unavailable', async () => {
    routingSettingsServiceMock.getAdminRoutingSettings.mockResolvedValueOnce({
      ...sampleSettings,
      source: 'environment_default',
      lastUpdatedById: null,
      lastUpdatedByName: null,
      lastUpdatedAt: null,
      warning: 'Routing settings migration required.',
    })

    const response = await GET(makeJsonRequest('http://localhost/api/admin/settings/routing', 'GET') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.warning).toBe('Routing settings migration required.')
    expect(json.source).toBe('environment_default')
  })

  it('rejects invalid primary providers', async () => {
    const response = await PATCH(
      makeJsonRequest('http://localhost/api/admin/settings/routing', 'PATCH', {
        primaryProvider: 'gps',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/Primary routing provider/)
    expect(routingSettingsServiceMock.updateRoutingSettings).not.toHaveBeenCalled()
  })

  it('saves the provider setting and clears routing cache', async () => {
    routingSettingsServiceMock.updateRoutingSettings.mockResolvedValueOnce({
      changed: true,
      settings: {
        ...sampleSettings,
        primaryProvider: 'google_routes',
        fallbackProvider: 'ors',
      },
    })

    const response = await PATCH(
      makeJsonRequest('http://localhost/api/admin/settings/routing', 'PATCH', {
        primaryProvider: 'google_routes',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(routingSettingsServiceMock.updateRoutingSettings).toHaveBeenCalledWith({
      primaryProvider: 'google_routes',
      adminUserId: 'admin-1',
    })
    expect(routingMock.clearRoutingCache).toHaveBeenCalledTimes(1)
    expect(json.settings.primaryProvider).toBe('google_routes')
  })

  it('returns 503 when the routing settings migration is missing', async () => {
    routingSettingsServiceMock.updateRoutingSettings.mockRejectedValueOnce(
      new routingSettingsMigrationRequiredError(),
    )

    const response = await PATCH(
      makeJsonRequest('http://localhost/api/admin/settings/routing', 'PATCH', {
        primaryProvider: 'ors',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.message).toBe('Routing settings migration required.')
    expect(routingMock.clearRoutingCache).not.toHaveBeenCalled()
  })
})