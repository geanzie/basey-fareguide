// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'

let currentPathname = '/admin/reports'
const replaceMock = vi.fn((nextPathname: string) => {
  currentPathname = nextPathname
})
const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
  }),
}))

import { AuthProvider, useAuth } from '@/components/AuthProvider'
import RoleGuard from '@/components/RoleGuard'
import {
  AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS,
  AUTH_SESSION_IDLE_TIMEOUT_MS,
  AUTH_SESSION_REVALIDATION_MS,
} from '@/lib/authSession'

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })

  return { promise, resolve }
}

function makeSessionResponse(userType: 'ADMIN' | 'PUBLIC' = 'ADMIN') {
  return {
    user: {
      id: 'user-1',
      username: 'sample-user',
      userType,
      firstName: 'Sample',
      lastName: 'User',
      isActive: true,
      isVerified: true,
    },
  }
}

function AuthTestHarness({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        errorRetryCount: 0,
      }}
    >
      <AuthProvider>{children}</AuthProvider>
    </SWRConfig>
  )
}

function ProtectedReportsHarness() {
  const { logout } = useAuth()

  return (
    <>
      <button type="button" onClick={() => void logout()}>
        Trigger logout
      </button>
      <RoleGuard allowedRoles={['ADMIN']}>
        <div>Protected admin reports</div>
      </RoleGuard>
    </>
  )
}

function LogoutStatusHarness() {
  const { logout, status } = useAuth()

  return (
    <>
      <button type="button" onClick={() => void logout()}>
        Trigger logout
      </button>
      <div>Auth status: {status}</div>
    </>
  )
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('auth guard transitions', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let sessionResponse: Response | Promise<Response>
  let logoutResponse: Response | Promise<Response>

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    currentPathname = '/admin/reports'
    replaceMock.mockClear()
    pushMock.mockClear()
    refreshMock.mockClear()

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    sessionResponse = makeJsonResponse(makeSessionResponse('ADMIN'))
    logoutResponse = makeJsonResponse({ success: true })

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.endsWith('/api/auth/session')) {
        return sessionResponse instanceof Response
          ? Promise.resolve(sessionResponse)
          : sessionResponse
      }

      if (url.endsWith('/api/auth/logout')) {
        return logoutResponse instanceof Response
          ? Promise.resolve(logoutResponse)
          : logoutResponse
      }

      throw new Error(`Unhandled fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })

    vi.useRealTimers()
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('redirects unauthenticated users to /login without showing Access Denied', async () => {
    sessionResponse = makeJsonResponse({ message: 'Unauthorized' }, 401)

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <RoleGuard allowedRoles={['ADMIN']}>
            <div>Protected admin reports</div>
          </RoleGuard>
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(replaceMock).toHaveBeenCalledWith('/login')
    expect(container.textContent).toContain('Redirecting to login')
    expect(container.textContent).not.toContain('Access Denied')
    expect(container.textContent).not.toContain('Protected admin reports')
  })

  it('shows Access Denied only for authenticated users with the wrong role', async () => {
    sessionResponse = makeJsonResponse(makeSessionResponse('PUBLIC'))

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <RoleGuard allowedRoles={['ADMIN']}>
            <div>Protected admin reports</div>
          </RoleGuard>
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(container.textContent).toContain('Access Denied')
    expect(container.textContent).not.toContain('Redirecting to login')
    expect(replaceMock).not.toHaveBeenCalledWith('/login')
  })

  it('renders a neutral loading shell while auth is resolving', async () => {
    const pendingProfile = deferredResponse()
    sessionResponse = pendingProfile.promise

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <RoleGuard allowedRoles={['ADMIN']}>
            <div>Protected admin reports</div>
          </RoleGuard>
        </AuthTestHarness>,
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Verifying access')
    expect(container.textContent).not.toContain('Access Denied')
    expect(container.textContent).not.toContain('Protected admin reports')

    await act(async () => {
      pendingProfile.resolve(makeJsonResponse(makeSessionResponse('ADMIN')))
      await flushPromises()
    })
  })

  it('falls back to unauthenticated routing when the initial session bootstrap never resolves', async () => {
    const pendingProfile = deferredResponse()
    sessionResponse = pendingProfile.promise

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <RoleGuard allowedRoles={['ADMIN']}>
            <div>Protected admin reports</div>
          </RoleGuard>
        </AuthTestHarness>,
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Verifying access')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS)
      await flushPromises()
    })

    expect(replaceMock).toHaveBeenCalledWith('/login')
    expect(container.textContent).toContain('Redirecting to login')
    expect(container.textContent).not.toContain('Protected admin reports')
  })

  it('logs out from a protected page without flashing Access Denied and redirects to /', async () => {
    const pendingLogout = deferredResponse()
    logoutResponse = pendingLogout.promise

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <ProtectedReportsHarness />
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(container.textContent).toContain('Protected admin reports')

    const logoutButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Trigger logout'),
    )

    expect(logoutButton).toBeTruthy()

    await act(async () => {
      logoutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Signing out')
    expect(container.textContent).not.toContain('Access Denied')
    expect(container.textContent).not.toContain('Protected admin reports')

    await act(async () => {
      pendingLogout.resolve(makeJsonResponse({ success: true }))
      await flushPromises()
    })

    expect(replaceMock).toHaveBeenCalledWith('/')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('clears the signing out state after navigation reaches /', async () => {
    const pendingLogout = deferredResponse()
    logoutResponse = pendingLogout.promise

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <LogoutStatusHarness />
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(container.textContent).toContain('Auth status: authenticated')

    const logoutButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Trigger logout'),
    )

    await act(async () => {
      logoutButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Auth status: logging_out')

    await act(async () => {
      pendingLogout.resolve(makeJsonResponse({ success: true }))
      await flushPromises()
    })

    await act(async () => {
      root.render(
        <AuthTestHarness>
          <LogoutStatusHarness />
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(currentPathname).toBe('/')
    expect(container.textContent).toContain('Auth status: unauthenticated')
    expect(container.textContent).not.toContain('Auth status: logging_out')
  })

  it('automatically logs the user out after the idle timeout elapses', async () => {
    await act(async () => {
      root.render(
        <AuthTestHarness>
          <LogoutStatusHarness />
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(container.textContent).toContain('Auth status: authenticated')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_SESSION_IDLE_TIMEOUT_MS)
      await flushPromises()
    })

    expect(replaceMock).toHaveBeenCalledWith('/')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('revalidates the session and logs out after the server starts returning 401', async () => {
    await act(async () => {
      root.render(
        <AuthTestHarness>
          <ProtectedReportsHarness />
        </AuthTestHarness>,
      )
      await flushPromises()
    })

    expect(container.textContent).toContain('Protected admin reports')

    sessionResponse = makeJsonResponse({ message: 'Unauthorized' }, 401)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_SESSION_REVALIDATION_MS)
      await flushPromises()
    })

    expect(replaceMock).toHaveBeenCalledWith('/')
    expect(container.textContent).toContain('Signing out')
  })
})
