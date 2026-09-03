// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import PageShell from '@/ui/PageShell'

/**
 * Regression cover for the header/content overlap. Pages used to float their
 * own content up under the brand band with a bare `-mt-6`, which only looked
 * right when the first child happened to be an opaque card — /calculator and
 * /admin start with a plain toolbar and heading, so their dark text landed on
 * the green gradient. PageShell owns the float and carries the opaque plate.
 */
describe('PageShell', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(node: React.ReactNode) {
    act(() => {
      root.render(node as React.ReactElement)
    })
  }

  it('floats page content on an opaque plate, never on the gradient band', () => {
    render(
      <PageShell title="Fare Calculator" subtitle="Plan a route">
        <h2 data-testid="first-child">Choose a ride</h2>
      </PageShell>,
    )

    const header = container.querySelector('header')!
    const plate = container.querySelector('.-mt-6')!

    expect(header.className).toContain('bg-brand')
    // the plate is a sibling of the band, not a child of it
    expect(header.contains(plate)).toBe(false)
    expect(plate.className).toContain('bg-surface-bg')
    expect(plate.className).toContain('rounded-t-plate')

    // and the page's own first child sits inside the plate
    const firstChild = container.querySelector('[data-testid="first-child"]')!
    expect(plate.contains(firstChild)).toBe(true)
    expect(header.contains(firstChild)).toBe(false)
  })

  it('renders the band below the status bar in the standalone PWA', () => {
    render(<PageShell title="Dashboard">content</PageShell>)

    const header = container.querySelector('header')!
    expect(header.className).toContain('env(safe-area-inset-top')
  })

  it('matches the band width to the content column', () => {
    render(
      <PageShell title="Fare Calculator" width="narrow">
        content
      </PageShell>,
    )

    // the band and the plate share one wrapper, so they cannot disagree
    const wrapper = container.querySelector('.max-w-4xl')!
    expect(wrapper.querySelector('header')).not.toBeNull()
    expect(wrapper.querySelector('.-mt-6')).not.toBeNull()
  })
})
