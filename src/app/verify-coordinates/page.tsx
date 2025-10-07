'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function VerifyCoordinatesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return // Still loading

    if (!user) {
      router.push('/auth/signin')
      return
    }

    // For non-admin users, show access denied message
    // This will be handled by the component below
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Redirecting to signin
  }

  if (user.userType === 'ADMIN') {
    return null // Redirecting to admin page
  }

  // Access denied for non-admin users
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Access Restricted
            </h1>
            <p className="text-gray-600 mb-6">
              The Coordinate Verification Tool has been moved to the Admin section due to its technical nature.
              This tool is now only available to administrators.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>For Administrators:</strong> You can access this tool through the Admin Dashboard
                under "Coordinate Verification" or directly at /admin/coordinate-verification
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}