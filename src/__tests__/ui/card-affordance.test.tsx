// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import NavCard from '@/ui/NavCard'
import StatTile from '@/ui/StatTile'

/**
 * The affordance contract.
 *
 * Every dashboard card shares one shell — `rounded-card border-surface-border
 * bg-surface shadow-card` — so nothing about a card's *surface* says whether it
 * navigates. The trailing arrow is the only signal, and it only means anything
 * while inert cards refuse to render one. That is the invariant here: it is
 * cheap to break by adding an arrow "for balance" to a static tile, and once
 * broken every other card loses its meaning silently.
 */
describe('card navigation affordance', () => {
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
    act(() => root.render(node))
  }

  it('NavCard is an anchor to its href, arrow visible at rest', () => {
    render(<NavCard href="/encoder/ride-access" title="Ride Access" description="Mark reachable places" />)

    const anchor = container.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('/encoder/ride-access')
    // rendered unconditionally — not inside a hover-only wrapper
    expect(container.querySelector('svg')).not.toBeNull()
    expect(anchor.textContent).toContain('Ride Access')
  })

  it('NavCard takes keyboard focus and shows a ring', () => {
    render(<NavCard href="/x" title="X" />)

    const anchor = container.querySelector('a')!
    expect(anchor.className).toContain('focus-visible:ring-2')
    // an <a href> is focusable without a tabindex; assert we did not remove it
    expect(anchor.getAttribute('tabindex')).toBeNull()
  })

  it('a StatTile without href renders no anchor and no arrow', () => {
    render(<StatTile label="Storage Used" value="42 MB" />)

    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('a StatTile with href renders both', () => {
    render(<StatTile label="Saved Routes" value={3} href="/history?filter=routes" />)

    const anchor = container.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('/history?filter=routes')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('motion is opt-out for reduced-motion users', () => {
    render(<NavCard href="/x" title="X" />)
    expect(container.querySelector('a')!.className).toContain('motion-reduce:transform-none')
  })
})
