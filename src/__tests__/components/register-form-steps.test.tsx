// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import RegisterForm from '@/components/auth/RegisterForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('RegisterForm steps', () => {
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
    vi.restoreAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  const render = () =>
    act(async () => {
      root.render(<RegisterForm onSwitchToLogin={() => undefined} />)
    })
  const currentStep = () => container.querySelector('[aria-current="step"]')?.textContent
  const visiblePanel = () => container.querySelector('[role="group"]:not([hidden])')?.id
  const stepButton = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('ol button')].find((b) =>
      b.textContent?.includes(label),
    )!
  // The Back / Next / Create account row at the bottom of the form.
  const actionButtons = () =>
    [...container.querySelectorAll<HTMLButtonElement>('form > div > button')].filter(
      (b) => !b.textContent?.startsWith('Already have an account'),
    )
  const actionLabels = () => actionButtons().map((b) => b.textContent)
  const submit = () =>
    act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
  const type = (id: string, value: string) =>
    act(async () => {
      const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!
      const isSelect = el instanceof HTMLSelectElement
      const proto = isSelect ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new Event(isSelect ? 'change' : 'input', { bubbles: true }))
    })
  const firstOption = (id: string) => container.querySelector<HTMLSelectElement>(`#${id}`)!.options[1].value
  const fillPersonal = async () => {
    await type('firstName', 'Juan')
    await type('lastName', 'Dela Cruz')
    await type('phoneNumber', '09171234567')
    await type('email', 'juan@example.com')
  }

  it('starts on step 1 with later steps locked and every field mounted', async () => {
    await render()

    expect(currentStep()).toContain('Personal')
    expect(visiblePanel()).toBe('register-panel-personal')
    expect(stepButton('Identity').disabled).toBe(true)
    expect(stepButton('Account').disabled).toBe(true)
    expect(container.querySelector('#username')).not.toBeNull()
    expect(actionLabels()).toEqual(['Next: Identity'])
  })

  it('advances only when the current step is valid, and Back keeps the values', async () => {
    await render()

    await submit()
    expect(currentStep()).toContain('Personal')

    await fillPersonal()
    await submit()
    expect(currentStep()).toContain('Identity')
    expect(stepButton('Personal').disabled).toBe(false)
    expect(stepButton('Account').disabled).toBe(true)
    expect(actionLabels()).toEqual(['Back', 'Next: Account'])

    await act(async () => {
      actionButtons()[0].click()
    })
    expect(currentStep()).toContain('Personal')
    expect(container.querySelector<HTMLInputElement>('#firstName')!.value).toBe('Juan')
  })

  it('offers Create account only on the last step', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    await render()

    await fillPersonal()
    await submit()
    expect(container.textContent).not.toContain('Create account')

    await type('idType', firstOption('idType'))
    await type('governmentId', 'ABCD12345')
    await type('barangayResidence', firstOption('barangayResidence'))
    await submit()
    expect(currentStep()).toContain('Account')
    expect(actionLabels()).toEqual(['Back', 'Create account'])

    // Account fields still empty: stays on the step, nothing sent.
    await submit()
    expect(currentStep()).toContain('Account')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
