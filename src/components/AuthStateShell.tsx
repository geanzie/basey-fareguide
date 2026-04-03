'use client'

import LoadingSpinner from '@/components/LoadingSpinner'

interface AuthStateShellProps {
  title: string
  message: string
  fullHeight?: boolean
}

export default function AuthStateShell({
  title,
  message,
  fullHeight = true,
}: AuthStateShellProps) {
  return (
    <div
      className={`app-page-bg flex items-center justify-center px-4 ${
        fullHeight ? 'min-h-screen' : 'min-h-[50vh]'
      }`}
    >
      <div className="app-surface-card-strong rounded-3xl px-8 py-10 text-center">
        <LoadingSpinner className="justify-center text-emerald-600 mb-4" size={32} />
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  )
}
