// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

const searchParams = { current: new URLSearchParams() }

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.current,
}))

const { default: useUrlFilter } = await import('@/hooks/useUrlFilter')

const ALLOWED = ['all', 'routes', 'incidents'] as const
type Filter = (typeof ALLOWED)[number]

/**
 * Both behaviours here were live bugs in UserHistory, and both were invisible:
 * the page rendered, it just rendered the wrong list.
 */
describe('useUrlFilter', () => {
  let container: HTMLDivElement
  let root: Root
  let select: (next: Filter) => void
  let seen: Filter

  function Probe() {
    const [filter, setFilter] = useUrlFilter<Filter>({
      param: 'filter',
      allowed: ALLOWED,
      fallback: 'all',
      aliases: { reports: 'incidents' },
    })
    seen = filter
    select = setFilter
    return <span>{filter}</span>
  }

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    searchParams.current = new URLSearchParams()
    window.history.replaceState(null, '', '/history')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render() {
    act(() => root.render(<Probe />))
  }

  it('resolves a public alias to the internal value', () => {
    searchParams.current = new URLSearchParams('filter=reports')
    render()
    expect(seen).toBe('incidents')
  })

  it('falls back instead of trusting an unknown value', () => {
    // ?filter=garbage used to pass a bare cast and render the incident branch
    searchParams.current = new URLSearchParams('filter=garbage')
    render()
    expect(seen).toBe('all')
  })

  it('re-syncs when the param changes while mounted', () => {
    searchParams.current = new URLSearchParams('filter=routes')
    render()
    expect(seen).toBe('routes')

    // the second dashboard card is clicked: same page, new query string
    searchParams.current = new URLSearchParams('filter=reports')
    render()
    expect(seen).toBe('incidents')
  })

  it('keeps a user selection that the unchanged param would otherwise undo', () => {
    searchParams.current = new URLSearchParams('filter=reports')
    render()

    act(() => select('routes'))
    expect(seen).toBe('routes')

    // a re-render with the stale param must not drag it back
    render()
    expect(seen).toBe('routes')
  })

  it('writes the selection to the URL without pushing history', () => {
    render()
    const before = window.history.length

    act(() => select('routes'))
    expect(window.location.search).toBe('?filter=routes')

    // returning to the default clears the param rather than spelling it out
    act(() => select('all'))
    expect(window.location.search).toBe('')
    expect(window.history.length).toBe(before)
  })
})
