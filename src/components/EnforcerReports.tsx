'use client'

import { useState, useEffect } from 'react'

interface ReportData {
  dailyIncidents: { date: string; count: number; resolved: number }[]
  violationBreakdown: { type: string; count: number; percentage: number }[]
  enforcerStats: {
    name: string
    incidentsHandled: number
    averageResolutionTime: string
    ticketsIssued: number
    efficiency: number
  }[]
  locationStats: { area: string; incidents: number; trend: 'up' | 'down' | 'stable' }[]
}

const EnforcerReports = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7') // days
  const [reportType, setReportType] = useState('overview')

  useEffect(() => {
    fetchReportData()
  }, [timeRange])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      // Mock data - in real implementation, this would fetch from API
      const mockData: ReportData = {
        dailyIncidents: [
          { date: '2024-10-01', count: 8, resolved: 6 },
          { date: '2024-10-02', count: 12, resolved: 10 },
          { date: '2024-10-03', count: 6, resolved: 5 },
          { date: '2024-10-04', count: 15, resolved: 12 },
          { date: '2024-10-05', count: 9, resolved: 7 }
        ],
        violationBreakdown: [
          { type: 'Fare Overcharge', count: 18, percentage: 36 },
          { type: 'Reckless Driving', count: 12, percentage: 24 },
          { type: 'Vehicle Violation', count: 10, percentage: 20 },
          { type: 'Route Violation', count: 6, percentage: 12 },
          { type: 'No Permit', count: 4, percentage: 8 }
        ],
        enforcerStats: [
          {
            name: 'Officer Rodriguez',
            incidentsHandled: 25,
            averageResolutionTime: '2.3h',
            ticketsIssued: 18,
            efficiency: 92
          },
          {
            name: 'Officer Santos',
            incidentsHandled: 22,
            averageResolutionTime: '2.8h',
            ticketsIssued: 15,
            efficiency: 88
          }
        ],
        locationStats: [
          { area: 'Poblacion Market', incidents: 15, trend: 'up' },
          { area: 'School Zone', incidents: 12, trend: 'down' },
          { area: 'Highway Junction', incidents: 8, trend: 'stable' },
          { area: 'Port Area', incidents: 5, trend: 'stable' }
        ]
      }
      setReportData(mockData)
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = () => {
    // In a real implementation, this would generate and download a PDF report
    alert('Report generation feature coming soon!')
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈'
      case 'down': return '📉'
      case 'stable': return '➡️'
      default: return '📊'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-red-600'
      case 'down': return 'text-green-600'
      case 'stable': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 Enforcement Reports</h2>
          <p className="text-gray-600">Performance analytics and incident statistics</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
          </select>
          <button
            onClick={generateReport}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <span>📄</span>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview', icon: '📋' },
              { id: 'violations', label: 'Violations', icon: '🚨' },
              { id: 'performance', label: 'Performance', icon: '📈' },
              { id: 'locations', label: 'Hotspots', icon: '📍' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportType(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  reportType === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {reportType === 'overview' && reportData && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {reportData.dailyIncidents.reduce((sum, day) => sum + day.count, 0)}
                  </div>
                  <div className="text-sm text-blue-800">Total Incidents</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {reportData.dailyIncidents.reduce((sum, day) => sum + day.resolved, 0)}
                  </div>
                  <div className="text-sm text-green-800">Resolved</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(
                      (reportData.dailyIncidents.reduce((sum, day) => sum + day.resolved, 0) /
                      reportData.dailyIncidents.reduce((sum, day) => sum + day.count, 0)) * 100
                    )}%
                  </div>
                  <div className="text-sm text-purple-800">Resolution Rate</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {reportData.enforcerStats.reduce((sum, stat) => sum + stat.ticketsIssued, 0)}
                  </div>
                  <div className="text-sm text-orange-800">Tickets Issued</div>
                </div>
              </div>

              {/* Daily Incident Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Daily Incident Trend</h3>
                <div className="space-y-2">
                  {reportData.dailyIncidents.map((day) => {
                    const maxCount = Math.max(...reportData.dailyIncidents.map(d => d.count))
                    const percentage = (day.count / maxCount) * 100
                    const resolvedPercentage = (day.resolved / day.count) * 100

                    return (
                      <div key={day.date} className="flex items-center space-x-4">
                        <div className="w-20 text-xs text-gray-600">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                          <div
                            className="bg-blue-500 h-6 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                          <div
                            className="bg-green-500 h-6 rounded-full absolute top-0 left-0"
                            style={{ width: `${(percentage * resolvedPercentage) / 100}%` }}
                          />
                        </div>
                        <div className="w-16 text-xs text-gray-600">
                          {day.resolved}/{day.count}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-center space-x-4 mt-4 text-xs text-gray-600">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Total Incidents</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Resolved</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === 'violations' && reportData && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Violation Type Breakdown</h3>
              {reportData.violationBreakdown.map((violation) => (
                <div key={violation.type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">🚨</div>
                    <div>
                      <div className="font-medium text-gray-900">{violation.type}</div>
                      <div className="text-sm text-gray-600">{violation.count} incidents</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{violation.percentage}%</div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${violation.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reportType === 'performance' && reportData && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Enforcer Performance</h3>
              {reportData.enforcerStats.map((stat) => (
                <div key={stat.name} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{stat.name}</h4>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {stat.efficiency}% Efficiency
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{stat.incidentsHandled}</div>
                      <div className="text-xs text-gray-600">Incidents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{stat.averageResolutionTime}</div>
                      <div className="text-xs text-gray-600">Avg. Resolution</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{stat.ticketsIssued}</div>
                      <div className="text-xs text-gray-600">Tickets Issued</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reportType === 'locations' && reportData && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Incident Hotspots</h3>
              {reportData.locationStats.map((location) => (
                <div key={location.area} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">📍</div>
                    <div>
                      <div className="font-medium text-gray-900">{location.area}</div>
                      <div className="text-sm text-gray-600">{location.incidents} incidents</div>
                    </div>
                  </div>
                  <div className={`flex items-center space-x-2 ${getTrendColor(location.trend)}`}>
                    <span>{getTrendIcon(location.trend)}</span>
                    <span className="text-sm font-medium capitalize">{location.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnforcerReports