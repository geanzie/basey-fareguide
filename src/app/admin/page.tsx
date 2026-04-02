'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'

const AdminUserManagement = dynamic(() => import('@/components/AdminUserManagement'), {
  loading: () => <div className="p-6">Loading users...</div>,
})

const StorageManagement = dynamic(() => import('@/components/StorageManagement'), {
  loading: () => <div className="p-6">Loading storage tools...</div>,
})

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <div className="p-6">Loading admin dashboard...</div>,
})

const AdminLocationManager = dynamic(() => import('@/components/AdminLocationManager'), {
  loading: () => <div className="p-6">Loading location manager...</div>,
})

type AdminTab = 'dashboard' | 'users' | 'storage' | 'locations'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent<AdminTab>
      if (customEvent.detail) {
        setActiveTab(customEvent.detail)
      }
    }

    window.addEventListener('adminTabChange', handleTabChange as EventListener)
    return () => window.removeEventListener('adminTabChange', handleTabChange as EventListener)
  }, [])

  const tabs: Array<{ key: AdminTab; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'User Management' },
    { key: 'storage', label: 'Storage Management' },
    { key: 'locations', label: 'Location Management' },
  ]

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Admin Dashboard"
        subtitle="Administration, oversight, storage, and location management"
      >
        <div className="mb-8">
          <nav className="flex flex-wrap gap-6 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'users' && <AdminUserManagement />}
        {activeTab === 'storage' && <StorageManagement />}
        {activeTab === 'locations' && <AdminLocationManager />}
        {activeTab === 'dashboard' && <AdminDashboard />}
      </PageWrapper>
    </RoleGuard>
  )
}
