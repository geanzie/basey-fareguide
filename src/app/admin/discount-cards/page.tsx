'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import AdminDiscountOverride from '@/components/AdminDiscountOverride'
import AdminDiscountList from '@/components/AdminDiscountList'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'

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
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-2 mb-4"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.back} size={DASHBOARD_ICON_POLICY.sizes.button} />
              <span>Back to Admin Dashboard</span>
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
                  <DashboardIconSlot icon={DASHBOARD_ICONS.list} size={DASHBOARD_ICON_POLICY.sizes.button} />
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
                  <DashboardIconSlot icon={DASHBOARD_ICONS.plus} size={DASHBOARD_ICON_POLICY.sizes.button} />
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
