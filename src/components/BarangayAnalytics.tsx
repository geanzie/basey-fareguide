'use client'

import { useEffect, useState } from 'react'

import LoadingSpinner from '@/components/LoadingSpinner'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
} from '@/components/dashboardIcons'

import { barangayService } from '../lib/barangayService'
import type { BarangayInfo } from '../utils/barangayBoundaries'

interface BarangayAnalyticsProps {
  incidents?: Array<{
    latitude: number
    longitude: number
    type?: string
    timestamp?: string
  }>
  className?: string
}

export default function BarangayAnalytics({
  incidents = [],
  className = '',
}: BarangayAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<{
    barangayHotspots: Array<{
      barangay: BarangayInfo
      incidentCount: number
      incidentTypes: Record<string, number>
    }>
    totalMappedIncidents: number
  } | null>(null)

  const [selectedBarangay, setSelectedBarangay] = useState<BarangayInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [allBarangays, setAllBarangays] = useState<BarangayInfo[]>([])

  useEffect(() => {
    const initializeAnalytics = async () => {
      setIsLoading(true)
      try {
        await barangayService.initialize()
        const barangays = barangayService.getBarangays()
        setAllBarangays(barangays)

        if (incidents.length > 0) {
          const analysis = barangayService.analyzeGeographicHotspots(incidents)
          setAnalyticsData(analysis)
        }
      } catch {
      } finally {
        setIsLoading(false)
      }
    }

    initializeAnalytics()
  }, [incidents])

  const getIncidentTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      fare_dispute: 'bg-red-100 text-red-800',
      overcharging: 'bg-orange-100 text-orange-800',
      route_violation: 'bg-yellow-100 text-yellow-800',
      safety_issue: 'bg-purple-100 text-purple-800',
      vehicle_condition: 'bg-blue-100 text-blue-800',
      default: 'bg-gray-100 text-gray-800',
    }
    return colors[type] || colors.default
  }

  const getSafetyLevel = (incidentCount: number): { level: string; color: string; icon: DashboardIcon } => {
    if (incidentCount === 0) return { level: 'Safe', color: 'text-green-600', icon: DASHBOARD_ICONS.safe }
    if (incidentCount <= 2) return { level: 'Low Risk', color: 'text-yellow-600', icon: DASHBOARD_ICONS.danger }
    if (incidentCount <= 5) return { level: 'Moderate Risk', color: 'text-orange-600', icon: DASHBOARD_ICONS.reports }
    return { level: 'High Risk', color: 'text-red-600', icon: DASHBOARD_ICONS.reports }
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner className="mr-3 text-blue-600" size={28} />
          <span className="text-gray-600">Analyzing barangay data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <span className={getDashboardIconChipClasses('blue')}>
              <DashboardIconSlot icon={DASHBOARD_ICONS.dashboard} size={DASHBOARD_ICON_POLICY.sizes.card} />
            </span>
            <span>Barangay Analytics</span>
          </h2>
          <div className="text-sm text-gray-500">
            {allBarangays.length} Barangays Monitored
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{allBarangays.length}</div>
            <div className="text-sm text-blue-700">Total Barangays</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {allBarangays.filter((b) => b.isPoblacion).length}
            </div>
            <div className="text-sm text-green-700">Poblacion Areas</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {analyticsData?.totalMappedIncidents || 0}
            </div>
            <div className="text-sm text-orange-700">Mapped Incidents</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {analyticsData?.barangayHotspots.length || 0}
            </div>
            <div className="text-sm text-purple-700">Active Hotspots</div>
          </div>
        </div>

        {analyticsData && analyticsData.barangayHotspots.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-amber-600" />
              <span>Incident Hotspots</span>
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData.barangayHotspots.slice(0, 10).map((hotspot) => {
                const safety = getSafetyLevel(hotspot.incidentCount)
                return (
                  <div
                    key={hotspot.barangay.code}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedBarangay(hotspot.barangay)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <DashboardIconSlot icon={safety.icon} size={DASHBOARD_ICON_POLICY.sizes.section} className={safety.color} />
                        <div>
                          <h4 className="font-medium text-gray-800">{hotspot.barangay.name}</h4>
                          <div className="text-xs text-gray-500 inline-flex items-center gap-2">
                            <DashboardIconSlot
                              icon={hotspot.barangay.isPoblacion ? DASHBOARD_ICONS.building : DASHBOARD_ICONS.rural}
                              size={14}
                            />
                            <span>{hotspot.barangay.isPoblacion ? 'Poblacion' : 'Rural'} • Code: {hotspot.barangay.code}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-800">{hotspot.incidentCount}</div>
                        <div className={`text-xs font-medium ${safety.color}`}>{safety.level}</div>
                      </div>
                    </div>

                    {Object.keys(hotspot.incidentTypes).length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(hotspot.incidentTypes).map(([type, count]) => (
                          <span
                            key={type}
                            className={`px-2 py-1 text-xs rounded-full ${getIncidentTypeColor(type)}`}
                          >
                            {type.replace('_', ' ')}: {count}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={DASHBOARD_ICON_POLICY.sizes.section} className="text-blue-600" />
            <span>Safety Overview by Barangay</span>
          </h3>

          <div className="flex space-x-2 mb-4">
            <button className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
              All ({allBarangays.length})
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 inline-flex items-center gap-2">
              <DashboardIconSlot icon={DASHBOARD_ICONS.building} size={14} />
              <span>Poblacion ({allBarangays.filter((b) => b.isPoblacion).length})</span>
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 inline-flex items-center gap-2">
              <DashboardIconSlot icon={DASHBOARD_ICONS.rural} size={14} />
              <span>Rural ({allBarangays.filter((b) => !b.isPoblacion).length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {allBarangays.map((barangay) => {
              const hotspot = analyticsData?.barangayHotspots.find((h) => h.barangay.code === barangay.code)
              const incidentCount = hotspot?.incidentCount || 0
              const safety = getSafetyLevel(incidentCount)

              return (
                <div
                  key={barangay.code}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedBarangay(barangay)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DashboardIconSlot icon={safety.icon} size={DASHBOARD_ICON_POLICY.sizes.button} className={safety.color} />
                      <div>
                        <div className="font-medium text-sm text-gray-800">{barangay.name}</div>
                        <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                          <DashboardIconSlot
                            icon={barangay.isPoblacion ? DASHBOARD_ICONS.building : DASHBOARD_ICONS.rural}
                            size={12}
                          />
                          <span>{barangay.code}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{incidentCount}</div>
                      <div className={`text-xs ${safety.color}`}>{safety.level}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedBarangay ? (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={DASHBOARD_ICON_POLICY.sizes.section} />
                <span>{selectedBarangay.name} Details</span>
              </h4>
              <button
                onClick={() => setSelectedBarangay(null)}
                className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center gap-2"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>Close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-700">Barangay Code:</div>
                <div className="text-blue-700">{selectedBarangay.code}</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Type:</div>
                <div className={`${selectedBarangay.isPoblacion ? 'text-blue-700' : 'text-green-700'} inline-flex items-center gap-2`}>
                  <DashboardIconSlot
                    icon={selectedBarangay.isPoblacion ? DASHBOARD_ICONS.building : DASHBOARD_ICONS.rural}
                    size={14}
                  />
                  <span>{selectedBarangay.isPoblacion ? 'Poblacion' : 'Rural'}</span>
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Geographic Center:</div>
                <div className="text-gray-600 text-xs">
                  {selectedBarangay.center[1].toFixed(4)}, {selectedBarangay.center[0].toFixed(4)}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Incident Count:</div>
                <div className="text-blue-700">
                  {analyticsData?.barangayHotspots.find((h) => h.barangay.code === selectedBarangay.code)?.incidentCount || 0}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="font-medium text-gray-700 mb-2">Nearby Barangays:</div>
              <div className="flex flex-wrap gap-2">
                {barangayService.getNeighboringBarangays(selectedBarangay, 3).slice(0, 5).map((neighbor) => (
                  <span
                    key={neighbor.code}
                    className="px-2 py-1 text-xs bg-white border border-blue-200 rounded-full text-blue-700"
                  >
                    {neighbor.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
