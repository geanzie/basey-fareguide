'use client'

import { useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import NotificationCenter from '@/components/NotificationCenter'
import EnforcerDashboard from '@/components/EnforcerDashboard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import HotspotAnalytics from '@/components/HotspotAnalytics'
import OfflineIncidentMap from '@/components/OfflineIncidentMap'
import PatrolManagement from '@/components/PatrolManagement'
import EnforcerReports from '@/components/EnforcerReports'
import PageWrapper from '@/components/PageWrapper'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <EnforcerContent />
    </RoleGuard>
  )
}

function EnforcerContent() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'incidents', label: 'Incident Queue', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'reports', label: 'Reports', icon: '📝' },
    { id: 'offline-map', label: 'Offline Map', icon: '📍' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <EnforcerDashboard />
      case 'incidents':
        return <EnforcerIncidentsList />
      case 'analytics':
        return <HotspotAnalytics />
      case 'reports':
        return <EnforcerReports />
      case 'offline-map':
        return <OfflineIncidentMap />
      default:
        return <EnforcerDashboard />
    }
  }

  const handleNotificationClick = (notification: any) => {
    if (notification.incidentId) {
      setActiveTab('incidents')
    }
  }

  return (
    <PageWrapper 
      title="Traffic Enforcement Center"
      subtitle="Comprehensive enforcement management system"
      headerContent={
        <NotificationCenter onNotificationClick={handleNotificationClick} />
      }
    >
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        {/* Mobile: Dropdown Menu */}
        <div className="md:hidden p-4">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.icon} {tab.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop: Horizontal Tabs */}
        <nav className="hidden md:flex px-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-0">
        {renderTabContent()}
      </div>
    </PageWrapper>
  )
}