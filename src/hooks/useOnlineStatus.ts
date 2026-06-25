'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks browser online/offline status. Starts optimistic (true) so SSR/first
 * paint never shows an offline banner before hydration. Updates from the
 * `online`/`offline` window events.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()

    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return online
}
