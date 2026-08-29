'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FileWarning } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import RoleGuard from '@/components/RoleGuard'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import EmptyState from '@/ui/EmptyState'
import PageShell from '@/ui/PageShell'
import { Select } from '@/ui/Field'
import { ListSkeleton } from '@/ui/Skeleton'
import { swrFetcher } from '@/lib/swr'

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

interface ReportsResponse {
  success: boolean
  data?: ReportData
  message?: string
}

type Period = '7d' | '30d' | '90d' | '1y'

export default function AdminReportsPage() {
  const { status, user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  const canLoadReports = status === 'authenticated' && user?.userType === 'ADMIN'

  const { data: response, error: fetchError, isLoading } = useSWR<ReportsResponse>(
    canLoadReports ? `/api/admin/reports?period=${selectedPeriod}` : null,
    swrFetcher,
  )

  const reportData = response?.success ? (response.data ?? null) : null
  const error = fetchError
    ? 'Failed to load system reports'
    : response && !response.success
      ? response.message || 'Failed to load system reports'
      : null

  const exportReport = () => {
    if (!reportData) return

    const csvContent = [
      'Basey Fare Check Operations Report',
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

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="System Reports"
        subtitle="Analytics and operational reporting based on live data only"
        backHref="/admin"
      >
        <div className="space-y-4">
          {isLoading ? (
            <ListSkeleton count={4} variant="complex" />
          ) : error ? (
            <Card>
              <EmptyState icon={FileWarning} title="Unable to load reports" message={error} />
            </Card>
          ) : reportData ? (
            <>
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-ink-strong">Operations Report</h3>
                    <p className="text-sm text-ink-muted">
                      Generated: {new Date(reportData.generatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <Select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value as Period)}
                      className="sm:w-auto"
                    >
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="1y">Last year</option>
                    </Select>

                    <Button size="sm" onClick={exportReport}>
                      Export CSV
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <h3 className="mb-4 text-lg font-bold text-ink-strong">Incident Analytics</h3>

                  <section className="mb-6 space-y-2">
                    <h4 className="font-semibold text-ink-body">By Status</h4>
                    {Object.entries(reportData.incidents.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-ink-muted">
                          {status.toLowerCase().replace('_', ' ')}
                        </span>
                        <span className="text-sm font-bold text-ink-strong">{count}</span>
                      </div>
                    ))}
                  </section>

                  <section className="space-y-2">
                    <h4 className="font-semibold text-ink-body">By Type</h4>
                    {Object.entries(reportData.incidents.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-ink-muted">
                          {type.toLowerCase().replace('_', ' ')}
                        </span>
                        <span className="text-sm font-bold text-ink-strong">{count}</span>
                      </div>
                    ))}
                  </section>
                </Card>

                <Card>
                  <h3 className="mb-4 text-lg font-bold text-ink-strong">User Analytics</h3>
                  <p className="mb-6 text-sm text-ink-muted">
                    {reportData.users.total} total users, {reportData.users.active} active in the selected period.
                  </p>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-ink-body">By User Type</h4>
                    {Object.entries(reportData.users.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-ink-muted">
                          {type.toLowerCase().replace('_', ' ')}
                        </span>
                        <span className="text-sm font-bold text-ink-strong">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h3 className="mb-4 text-lg font-bold text-ink-strong">Storage Analytics</h3>
                  <p className="mb-6 text-sm text-ink-muted">
                    {reportData.storage.totalFiles} stored file{reportData.storage.totalFiles === 1 ? '' : 's'} using{' '}
                    {reportData.storage.totalSizeMB.toFixed(1)} MB.
                  </p>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-ink-body">By File Type</h4>
                    {Object.entries(reportData.storage.byType).map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm text-ink-muted">{type}</span>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong">{data.files} files</div>
                          <div className="text-xs text-ink-faint">{data.sizeMB.toFixed(1)} MB</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h3 className="mb-4 text-lg font-bold text-ink-strong">Monthly Incident Trends</h3>

                  <div className="space-y-3">
                    {Object.entries(reportData.incidents.monthlyTrends).length > 0 ? (
                      Object.entries(reportData.incidents.monthlyTrends).map(([month, data]) => (
                        <div
                          key={month}
                          className="flex items-center justify-between rounded-xl bg-surface-alt p-3"
                        >
                          <div>
                            <div className="text-sm font-bold text-ink-strong">{month}</div>
                            <div className="text-xs text-ink-faint">Resolved: {data.resolved}</div>
                          </div>
                          <div className="text-sm font-bold text-ink-strong">{data.total} total</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-faint">No incident trend data is available for this period.</p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      </PageShell>
    </RoleGuard>
  )
}
