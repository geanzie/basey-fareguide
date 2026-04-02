'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'

interface ReportData {
  generatedAt: string
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
      const response = await fetch(`/api/admin/reports?period=${selectedPeriod}`)
      const result = await response.json()

      if (result.success) {
        setReportData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load system reports')
      }
    } catch (_error) {
      setError('Failed to load system reports')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!reportData) return

    const csvContent = [
      'Basey Fare Guide Operations Report',
      `Generated: ${new Date(reportData.generatedAt).toLocaleString()}`,
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
      ...Object.entries(reportData.storage.byType).map(([type, data]) => `${type},${data.files} files,${data.sizeMB} MB`),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `basey-fareguide-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <RoleGuard allowedRoles={['ADMIN']}>
        <PageWrapper title="System Reports" subtitle="Analytics and operational reporting">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-48 bg-gray-200 rounded"></div>
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
        subtitle="Analytics and operational reporting based on live data only"
      >
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        ) : null}

        {reportData ? (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Operations Report</h3>
                  <p className="text-sm text-gray-600">
                    Generated: {new Date(reportData.generatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-3">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d' | '90d' | '1y')}
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
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Incident Analytics</h3>

                <section className="space-y-2 mb-6">
                  <h4 className="font-medium text-gray-700">By Status</h4>
                  {Object.entries(reportData.incidents.byStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{status.toLowerCase().replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </section>

                <section className="space-y-2">
                  <h4 className="font-medium text-gray-700">By Type</h4>
                  {Object.entries(reportData.incidents.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </section>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Analytics</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {reportData.users.total} total users, {reportData.users.active} active in the selected period.
                </p>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">By User Type</h4>
                  {Object.entries(reportData.users.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Analytics</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {reportData.storage.totalFiles} stored file{reportData.storage.totalFiles === 1 ? '' : 's'} using{' '}
                  {reportData.storage.totalSizeMB.toFixed(1)} MB.
                </p>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">By File Type</h4>
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

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Incident Trends</h3>

                <div className="space-y-3">
                  {Object.entries(reportData.incidents.monthlyTrends).length > 0 ? (
                    Object.entries(reportData.incidents.monthlyTrends).map(([month, data]) => (
                      <div key={month} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{month}</div>
                          <div className="text-xs text-gray-500">Resolved: {data.resolved}</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{data.total} total</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No incident trend data is available for this period.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </PageWrapper>
    </RoleGuard>
  )
}
