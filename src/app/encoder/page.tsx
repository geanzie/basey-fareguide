'use client'

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'

export default function EncoderPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.userType !== 'DATA_ENCODER')) {
      router.push('/auth')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!user || user.userType !== 'DATA_ENCODER') {
    return null
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Encoder Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Manage driver and vehicle permits for Basey Municipality
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Welcome, {user.firstName} {user.lastName}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="space-y-8">
          <PermitStatistics />
          <PermitManagement />
        </div>
      </div>
    </div>
  )
}