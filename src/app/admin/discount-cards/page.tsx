'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import AdminDiscountOverride from '@/components/AdminDiscountOverride'
import AdminDiscountList from '@/components/AdminDiscountList'

type TabType = 'list' | 'create'

export default function AdminDiscountCardsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('list')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSuccess = (discountCard: any) => {
    // Show success notification    // Switch to list tab and refresh the list
    setActiveTab('list')
    setRefreshKey(prev => prev + 1)
  }

  const handleCancel = () => {
    setActiveTab('list')
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="Discount Card Management"
        subtitle="Create and manage discount cards for eligible users"
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/admin')}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
            >
              <span>←</span> Back to Admin Dashboard
            </button>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-t-lg shadow-sm border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-6 py-4 font-medium text-sm transition-colors ${
                  activeTab === 'list'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Discount Cards List
                </div>
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-6 py-4 font-medium text-sm transition-colors ${
                  activeTab === 'create'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Discount Card
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'list' && (
              <AdminDiscountList key={refreshKey} />
            )}
            {activeTab === 'create' && (
              <div className="max-w-6xl mx-auto">
                <AdminDiscountOverride
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}
