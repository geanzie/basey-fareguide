'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Ticking countdown for a rate-limit lockout.
 *
 * The server sends `retryAfter` once, so a statically rendered "3552 seconds"
 * is wrong a second later and reads as a punishment with no end. Counting it
 * down visibly — and re-enabling the submit button on its own when it reaches
 * zero — turns the same limit into a wait the user can sit through.
 */
export function useRetryCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return

    const timer = setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsLeft])

  const start = useCallback((seconds: number | undefined) => {
    setSecondsLeft(seconds && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0)
  }, [])

  const clear = useCallback(() => setSecondsLeft(0), [])

  return { secondsLeft, isCountingDown: secondsLeft > 0, start, clear }
}
