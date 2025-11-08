'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AdminDiscountOverride from '@/components/AdminDiscountOverride'
import { useAuth } from '@/components/AuthProvider'

export default function AdminDiscountCardsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Check authentication and admin role
    if (!loading && !user) {
      router.push('/auth/login')
      return
    }

    if (!loading && user && user.userType !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [user, loading, router])

  const handleSuccess = (discountCard: any) => {
    // Show success notification (you can integrate with a toast/notification system)
    console.log('Discount card created successfully:', discountCard)
    
    // Optionally redirect after a delay
    setTimeout(() => {
      // You can redirect to a discount cards list page or stay on the page
      // router.push('/admin/dashboard')
    }, 2000)
  }

  const handleCancel = () => {
    router.push('/admin/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <span>←</span> Back to Dashboard
          </button>
        </div>

        <AdminDiscountOverride
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </DashboardLayout>
  )
}
