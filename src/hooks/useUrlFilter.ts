'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Options<T extends string> {
  /** Query-string key, e.g. 'filter' or 'status'. */
  param: string
  /** Every value this filter accepts. Anything else in the URL is discarded. */
  allowed: readonly T[]
  /** Used when the param is absent, unrecognised, or aliased to nothing. */
  fallback: T
  /**
   * Public param spellings that map onto an internal value, e.g.
   * { reports: 'incidents' } so /history?filter=reports keeps working.
   */
  aliases?: Readonly<Record<string, T>>
}

/**
 * Filter state that a link can set from outside the page.
 *
 * Two failures this exists to prevent, both of which were live:
 *
 * 1. *Read-once.* Seeding useState from the query string only works until the
 *    component is mounted. /dashboard linked to /history?filter=routes and
 *    ?filter=reports from separate cards; clicking the second while already on
 *    /history changed the URL and nothing else. The effect below re-syncs.
 *
 * 2. *Unvalidated.* A cast is not a check. ?filter=garbage passed straight
 *    through and silently rendered the incident branch. Unknown values now fall
 *    back instead of picking an arbitrary view.
 *
 * Writes go through history.replaceState, not the router: the param is a view
 * preference, and it should not push an entry the back button has to walk.
 */
export default function useUrlFilter<T extends string>({
  param,
  allowed,
  fallback,
  aliases,
}: Options<T>): [T, (next: T) => void] {
  const searchParams = useSearchParams()
  const raw = searchParams.get(param)

  const resolve = useCallback(
    (value: string | null): T => {
      if (!value) {
        return fallback
      }
      const aliased = aliases?.[value] ?? (value as T)
      return allowed.includes(aliased) ? aliased : fallback
    },
    // `allowed` and `aliases` are module-level constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fallback],
  )

  const [filter, setFilter] = useState<T>(() => resolve(raw))

  // Sync only when the *param* changes, never merely because this re-rendered.
  // Comparing against the resolved filter instead would fight the user: pick a
  // chip, and the still-unchanged param would immediately undo it.
  const lastRaw = useRef<string | null>(raw)

  useEffect(() => {
    if (raw === lastRaw.current) {
      return
    }
    lastRaw.current = raw
    setFilter(resolve(raw))
  }, [raw, resolve])

  const select = useCallback(
    (next: T) => {
      setFilter(next)

      if (typeof window === 'undefined') {
        return
      }

      const url = new URL(window.location.href)
      if (next === fallback) {
        url.searchParams.delete(param)
      } else {
        url.searchParams.set(param, next)
      }
      window.history.replaceState(null, '', url.toString())
    },
    [fallback, param],
  )

  return [filter, select]
}
