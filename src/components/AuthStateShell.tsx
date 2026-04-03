'use client'

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
      className={`flex items-center justify-center px-4 ${
        fullHeight ? 'min-h-screen' : 'min-h-[50vh]'
      }`}
    >
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600" />
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  )
}
