'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'

// Lazy-load admin modules to reduce initial bundle
const AdminUserManagement = dynamic(() => import('@/components/AdminUserManagement'), {
  loading: () => <div className="p-6">Loading users...</div>
})
const StorageManagement = dynamic(() => import('@/components/StorageManagement'), {
  loading: () => <div className="p-6">Loading storage tools...</div>
})
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <div className="p-6">Loading admin dashboard...</div>
})
const AdminLocationManager = dynamic(() => import('@/components/AdminLocationManager'), {
  loading: () => <div className="p-6">Loading location manager...</div>
})

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'storage' | 'locations' | 'settings'>('dashboard')

  // Listen for custom events from dashboard quick actions
  useEffect(() => {
    const handleTabChange = (event: any) => {
      setActiveTab(event.detail)
    }
    
    window.addEventListener('adminTabChange', handleTabChange)
    return () => window.removeEventListener('adminTabChange', handleTabChange)
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />
      case 'users':
        return <AdminUserManagement />
      case 'storage':
        return <StorageManagement />
      case 'locations':
        return <AdminLocationManager />
      case 'settings':
        return <AdminSettings />
      default:
        return <AdminDashboard />
    }
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="Admin Dashboard"
        subtitle="System administration and management"
      >
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { key: 'dashboard', label: '📊 Dashboard', icon: '📊' },
              { key: 'users', label: '👥 User Management', icon: '👥' },
              { key: 'storage', label: '💾 Storage Management', icon: '💾' },
              { key: 'locations', label: '📍 Location Management', icon: '📍' },
              { key: 'settings', label: '⚙️ System Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
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

        {/* Content */}
        {renderContent()}
      </PageWrapper>
    </RoleGuard>
  )
}

// Placeholder for Admin Settings component
function AdminSettings() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h2>
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-yellow-500 text-xl mr-3">⚠️</span>
            <div>
              <p className="text-yellow-800 font-semibold">Settings Configuration Coming Soon</p>
              <p className="text-yellow-700 text-sm">
                System settings and configuration options will be available in the next update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}