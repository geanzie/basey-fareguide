'use client'

import { useState, useEffect, memo } from 'react'
import useSWR from 'swr'

interface HotspotData {
  id: string
  area: string
  coordinates: {
    lat: number
    lng: number
  }
  incidentCount: number
  commonViolations: {
    type: string
    count: number
    percentage: number
  }[]
  timePatterns: {
    hour: number
    count: number
  }[]
  severityScore: number
  trend: 'increasing' | 'stable' | 'decreasing'
  recommendedAction: string
}

interface PatrolRecommendation {
  id: string
  area: string
  priority: 'high' | 'medium' | 'low'
  recommendedTime: string
  reason: string
  estimatedDuration: string
}

const HotspotAnalytics = () => {
  const [hotspots, setHotspots] = useState<HotspotData[]>([])
  const [patrols, setPatrols] = useState<PatrolRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('7') // days
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null)

  // SWR for hotspot data
  const { data, isLoading, error } = useSWR<{ hotspots: HotspotData[] }>(`/api/analytics/hotspots?period=${selectedPeriod}`)

  useEffect(() => {
    // Update local state when SWR data changes
    if (data?.hotspots) {
      setHotspots(data.hotspots)
    } else if (error) {
      // Fallback to mock if error
      setHotspots(generateMockHotspots())
    }
    setLoading(isLoading)
    generatePatrolRecommendations()
  }, [data, isLoading, error, selectedPeriod])

  // Removed manual fetch; using SWR

  const generatePatrolRecommendations = () => {
    // Mock patrol recommendations based on data analysis
    const recommendations: PatrolRecommendation[] = [
      {
        id: '1',
        area: 'Poblacion Market Area',
        priority: 'high',
        recommendedTime: '7:00 AM - 9:00 AM',
        reason: 'Peak fare violation incidents during morning rush',
        estimatedDuration: '2 hours'
      },
      {
        id: '2',
        area: 'Basey Elementary School Zone',
        priority: 'high',
        recommendedTime: '6:30 AM - 7:30 AM, 4:30 PM - 5:30 PM',
        reason: 'Reckless driving incidents near school hours',
        estimatedDuration: '2 hours total'
      },
      {
        id: '3',
        area: 'San Antonio Terminal',
        priority: 'medium',
        recommendedTime: '12:00 PM - 2:00 PM',
        reason: 'Vehicle violations and overloading issues',
        estimatedDuration: '1.5 hours'
      },
      {
        id: '4',
        area: 'Guintigui-an Route',
        priority: 'medium',
        recommendedTime: '5:00 PM - 7:00 PM',
        reason: 'Route violations during evening rush',
        estimatedDuration: '1 hour'
      }
    ]
    setPatrols(recommendations)
  }

  const generateMockHotspots = (): HotspotData[] => {
    return [
      {
        id: '1',
        area: 'Poblacion Market Area',
        coordinates: { lat: 11.2758, lng: 124.9628 },
        incidentCount: 15,
        commonViolations: [
          { type: 'FARE_OVERCHARGE', count: 8, percentage: 53.3 },
          { type: 'VEHICLE_VIOLATION', count: 4, percentage: 26.7 },
          { type: 'ROUTE_VIOLATION', count: 3, percentage: 20.0 }
        ],
        timePatterns: [
          { hour: 6, count: 2 },
          { hour: 7, count: 4 },
          { hour: 8, count: 3 },
          { hour: 16, count: 3 },
          { hour: 17, count: 3 }
        ],
        severityScore: 8.5,
        trend: 'increasing',
        recommendedAction: 'Increase morning and evening patrols, focus on fare compliance'
      },
      {
        id: '2',
        area: 'Basey Elementary School Zone',
        coordinates: { lat: 11.2760, lng: 124.9625 },
        incidentCount: 12,
        commonViolations: [
          { type: 'RECKLESS_DRIVING', count: 9, percentage: 75.0 },
          { type: 'VEHICLE_VIOLATION', count: 2, percentage: 16.7 },
          { type: 'OTHER', count: 1, percentage: 8.3 }
        ],
        timePatterns: [
          { hour: 6, count: 3 },
          { hour: 7, count: 4 },
          { hour: 16, count: 3 },
          { hour: 17, count: 2 }
        ],
        severityScore: 9.2,
        trend: 'stable',
        recommendedAction: 'Enhanced school zone enforcement during drop-off and pickup times'
      },
      {
        id: '3',
        area: 'San Antonio Terminal',
        coordinates: { lat: 11.2755, lng: 124.9630 },
        incidentCount: 8,
        commonViolations: [
          { type: 'VEHICLE_VIOLATION', count: 5, percentage: 62.5 },
          { type: 'ROUTE_VIOLATION', count: 2, percentage: 25.0 },
          { type: 'FARE_UNDERCHARGE', count: 1, percentage: 12.5 }
        ],
        timePatterns: [
          { hour: 10, count: 2 },
          { hour: 12, count: 2 },
          { hour: 14, count: 2 },
          { hour: 16, count: 2 }
        ],
        severityScore: 6.8,
        trend: 'decreasing',
        recommendedAction: 'Regular vehicle inspections and route compliance checks'
      }
    ]
  }

  const getSeverityColor = (score: number) => {
    if (score >= 8) return 'text-red-600 bg-red-100'
    if (score >= 6) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈'
      case 'decreasing': return '📉'
      case 'stable': return '➡️'
      default: return '📊'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hotspot Analytics</h2>
          <p className="text-gray-600">Incident patterns and patrol recommendations</p>
        </div>
        
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing incident patterns...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hotspots List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Identified Hotspots</h3>
            
            <div className="space-y-4">
              {hotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedHotspot(hotspot)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{hotspot.area}</h4>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(hotspot.severityScore)}`}>
                        {hotspot.severityScore}/10
                      </span>
                      <span className="text-lg">{getTrendIcon(hotspot.trend)}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {hotspot.incidentCount} incidents in selected period
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {hotspot.commonViolations.slice(0, 2).map((violation, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {violation.type.replace('_', ' ')} ({violation.percentage}%)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Patrol Recommendations */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🚔 Patrol Recommendations</h3>
            
            <div className="space-y-4">
              {patrols.map((patrol) => (
                <div key={patrol.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{patrol.area}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(patrol.priority)}`}>
                      {patrol.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>⏰ <strong>Time:</strong> {patrol.recommendedTime}</div>
                    <div>📝 <strong>Duration:</strong> {patrol.estimatedDuration}</div>
                    <div>💡 <strong>Reason:</strong> {patrol.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Hotspot Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Detailed Analysis: {selectedHotspot.area}
                </h3>
                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Violation Breakdown */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Violation Breakdown</h4>
                  <div className="space-y-2">
                    {selectedHotspot.commonViolations.map((violation, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {violation.type.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${violation.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {violation.count} ({violation.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Pattern */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Time Pattern</h4>
                  <div className="space-y-2">
                    {selectedHotspot.timePatterns.map((pattern, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {pattern.hour}:00 - {pattern.hour + 1}:00
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{ width: `${(pattern.count / Math.max(...selectedHotspot.timePatterns.map(p => p.count))) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{pattern.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Recommended Action</h4>
                <p className="text-blue-800 text-sm">{selectedHotspot.recommendedAction}</p>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(HotspotAnalytics)