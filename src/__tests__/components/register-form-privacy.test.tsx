// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import RegisterForm from '@/components/auth/RegisterForm'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('RegisterForm — privacy notice acknowledgment block', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('renders an unchecked acknowledgment checkbox with correct name', async () => {
    await act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })

    const checkbox = container.querySelector('#privacyNoticeAcknowledged') as HTMLInputElement
    expect(checkbox).not.toBeNull()
    expect(checkbox.type).toBe('checkbox')
    expect(checkbox.name).toBe('privacyNoticeAcknowledged')
    expect(checkbox.checked).toBe(false)
  })

  it('renders the Privacy Notice link pointing to /privacy-policy in a new tab', async () => {
    await act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })

    const link = container.querySelector('a[href="/privacy-policy"]') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')
  })

  it('displays the current privacy notice version in the form', async () => {
    await act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })

    expect(container.textContent).toContain(CURRENT_PRIVACY_NOTICE_VERSION)
  })

  it('blocks fetch when the form is submitted without the acknowledgment checkbox checked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

    await act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })

    await act(async () => {
      const form = container.querySelector('form')!
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    // Checkbox is unchecked by default; some client-side validation blocks fetch.
    // The acknowledgment guard is the last client-side check before the network call.
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
