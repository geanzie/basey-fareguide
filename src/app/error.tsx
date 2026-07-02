'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'
import Button from '@/ui/Button'
import EmptyState from '@/ui/EmptyState'

export default function Error({
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
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        message="An unexpected error occurred. Please try again — if it keeps happening, contact the municipal office."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  )
}
