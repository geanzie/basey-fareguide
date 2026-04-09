// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import RegisterForm from '@/components/auth/RegisterForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('RegisterForm accessibility metadata', () => {
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

  it('assigns expected autocomplete values to account and personal fields', async () => {
    await act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })

    expect(container.querySelector('#firstName')?.getAttribute('autocomplete')).toBe('given-name')
    expect(container.querySelector('#lastName')?.getAttribute('autocomplete')).toBe('family-name')
    expect(container.querySelector('#phoneNumber')?.getAttribute('autocomplete')).toBe('tel')
    expect(container.querySelector('#email')?.getAttribute('autocomplete')).toBe('email')
    expect(container.querySelector('#username')?.getAttribute('autocomplete')).toBe('username')
    expect(container.querySelector('#password')?.getAttribute('autocomplete')).toBe('new-password')
    expect(container.querySelector('#confirmPassword')?.getAttribute('autocomplete')).toBe('new-password')
    expect(container.querySelector('#idType')?.getAttribute('autocomplete')).toBe('off')
    expect(container.querySelector('#barangayResidence')?.getAttribute('autocomplete')).toBe('off')
  })
})