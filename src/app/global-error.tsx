'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Root-layout failure fallback — renders its own <html>, so no shared UI kit here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f1f5f9' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem' }}>
          <div>
            <h1 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              An unexpected error occurred while loading Basey FareCheck.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.75rem 1.25rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
