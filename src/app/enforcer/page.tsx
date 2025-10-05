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
    { id: 'patrol', label: 'Patrol Routes', icon: '🚓' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'reports', label: 'Reports', icon: '📝' },
    { id: 'offline-map', label: 'Offline Map', icon: '📍' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-4 md:p-6">
            <EnforcerDashboard />
          </div>
        )
      case 'incidents':
        return <EnforcerIncidentsList />
      case 'patrol':
        return (
          <div className="p-4 md:p-6">
            <PatrolManagement />
          </div>
        )
      case 'analytics':
        return (
          <div className="p-4 md:p-6">
            <HotspotAnalytics />
          </div>
        )
      case 'reports':
        return (
          <div className="p-4 md:p-6">
            <EnforcerReports />
          </div>
        )
      case 'offline-map':
        return (
          <div className="p-4 md:p-6">
            <OfflineIncidentMap />
          </div>
        )
      default:
        return (
          <div className="p-4 md:p-6">
            <EnforcerDashboard />
          </div>
        )
    }
  }

  const handleNotificationClick = (notification: any) => {
    if (notification.incidentId) {
      setActiveTab('incidents')
      // In a real implementation, you would scroll to or highlight the specific incident
    }
  }

  return (
    <main className="flex-1 bg-gray-50 flex flex-col min-h-0">
      {/* Header with Notifications */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 md:px-6 py-4">
          <div className="flex justify-between items-start md:items-center">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">
                🚔 Traffic Enforcement Center
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-1 hidden sm:block">
                Comprehensive enforcement management system
              </p>
              {/* Mobile: Show current tab */}
              <p className="text-sm text-blue-600 mt-1 sm:hidden">
                {tabs.find(tab => tab.id === activeTab)?.icon} {tabs.find(tab => tab.id === activeTab)?.label}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <NotificationCenter onNotificationClick={handleNotificationClick} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 md:px-6">
          {/* Mobile: Dropdown Menu */}
          <div className="md:hidden">
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
          <nav className="hidden md:flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Tablet: Scrollable Horizontal Tabs */}
          <div className="hidden sm:block md:hidden">
            <div className="overflow-x-auto">
              <nav className="flex space-x-6 py-2" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-2 px-3 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </main>
  )
}