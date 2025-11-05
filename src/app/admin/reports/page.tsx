'use client'

import { useState, useEffect } from 'react'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'

interface ReportData {
  incidents: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    monthlyTrends: Record<string, { total: number; resolved: number }>
  }
  users: {
    total: number
    active: number
    byType: Record<string, number>
    registrationTrends: Record<string, number>
  }
  storage: {
    totalFiles: number
    totalSizeMB: number
    byType: Record<string, { files: number; sizeMB: number }>
  }
  system: {
    responseTime: number
    uptime: string
    lastGenerated: string
  }
}

export default function AdminReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  useEffect(() => {
    fetchReportData()
  }, [selectedPeriod])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/admin/reports?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        setReportData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load system reports')
      }
      
    } catch (error) {
      console.error('Error fetching report data:', error)
      setError('Failed to load system reports')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!reportData) return
    
    // Create CSV content
    const csvContent = [
      'System Report - Basey Fare Guide',
      `Generated: ${new Date(reportData.system.lastGenerated).toLocaleString()}`,
      '',
      'INCIDENT STATISTICS',
      `Total Incidents,${reportData.incidents.total}`,
      'Status Breakdown:',
      ...Object.entries(reportData.incidents.byStatus).map(([status, count]) => `${status},${count}`),
      '',
      'USER STATISTICS',
      `Total Users,${reportData.users.total}`,
      `Active Users,${reportData.users.active}`,
      'User Type Breakdown:',
      ...Object.entries(reportData.users.byType).map(([type, count]) => `${type},${count}`),
      '',
      'STORAGE STATISTICS',
      `Total Files,${reportData.storage.totalFiles}`,
      `Total Size (MB),${reportData.storage.totalSizeMB}`,
      'File Type Breakdown:',
      ...Object.entries(reportData.storage.byType).map(([type, data]) => 
        `${type},${data.files} files,${data.sizeMB} MB`
      ),
    ].join('\n')
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `basey-fareguide-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <RoleGuard allowedRoles={['ADMIN']}>
        <PageWrapper title="System Reports" subtitle="Analytics and system insights">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </PageWrapper>
      </RoleGuard>
    )
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="System Reports"
        subtitle="Analytics, insights, and system performance metrics"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-3">❌</span>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {reportData && (
          <>
            {/* Report Controls */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">System Performance Report</h3>
                  <p className="text-sm text-gray-600">
                    Last updated: {new Date(reportData.system.lastGenerated).toLocaleString()}
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                  
                  <button
                    onClick={exportReport}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                  >
                    📊 Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
                <div className="text-3xl font-bold">{reportData.incidents.total}</div>
                <div className="text-blue-100">Total Incidents</div>
              </div>
              
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6">
                <div className="text-3xl font-bold">{reportData.users.active}</div>
                <div className="text-green-100">Active Users</div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6">
                <div className="text-3xl font-bold">{reportData.storage.totalSizeMB.toFixed(1)} MB</div>
                <div className="text-purple-100">Storage Used</div>
              </div>
              
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg p-6">
                <div className="text-3xl font-bold">{reportData.system.uptime}</div>
                <div className="text-emerald-100">System Uptime</div>
              </div>
            </div>

            {/* Detailed Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Incident Analytics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Incident Analytics</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">By Status</h4>
                    <div className="space-y-2">
                      {Object.entries(reportData.incidents.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">
                            {status.toLowerCase().replace('_', ' ')}
                          </span>
                          <div className="flex items-center">
                            <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                              <div 
                                className="bg-emerald-600 h-2 rounded-full"
                                style={{ width: `${(count / reportData.incidents.total) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 w-8">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">By Type</h4>
                    <div className="space-y-2">
                      {Object.entries(reportData.incidents.byType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">
                            {type.toLowerCase().replace('_', ' ')}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* User Analytics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Analytics</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{reportData.users.total}</div>
                      <div className="text-sm text-gray-600">Total Users</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{reportData.users.active}</div>
                      <div className="text-sm text-gray-600">Active Users</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">By User Type</h4>
                    <div className="space-y-2">
                      {Object.entries(reportData.users.byType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 capitalize">
                            {type.toLowerCase().replace('_', ' ')}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Storage Analytics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Analytics</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{reportData.storage.totalFiles}</div>
                      <div className="text-sm text-gray-600">Total Files</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {reportData.storage.totalSizeMB.toFixed(1)} MB
                      </div>
                      <div className="text-sm text-gray-600">Storage Used</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">By File Type</h4>
                    <div className="space-y-2">
                      {Object.entries(reportData.storage.byType).map(([type, data]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{type}</span>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">{data.files} files</div>
                            <div className="text-xs text-gray-500">{data.sizeMB.toFixed(1)} MB</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* System Performance */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Average Response Time</span>
                    <span className="text-sm font-semibold text-gray-900">{reportData.system.responseTime}ms</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-gray-600">System Uptime</span>
                    <span className="text-sm font-semibold text-green-600">{reportData.system.uptime}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-600">Database Status</span>
                    <span className="text-sm font-semibold text-blue-600">Healthy</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-gray-600">API Health</span>
                    <span className="text-sm font-semibold text-emerald-600">Operational</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </PageWrapper>
    </RoleGuard>
  )
}