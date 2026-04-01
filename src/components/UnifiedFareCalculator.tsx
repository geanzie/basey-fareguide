'use client'

import { useState, useEffect } from 'react'
import RoutePlannerCalculator from './RoutePlannerCalculator'
import { barangayService } from '../lib/barangayService'

export default function UnifiedFareCalculator() {
  const [barangayStats, setBarangayStats] = useState<{
    totalBarangays: number;
    poblacionCount: number;
    ruralCount: number;
  } | null>(null)

  useEffect(() => {
    // Initialize barangay service and get stats
    const initializeBarangayData = async () => {
      try {
        await barangayService.initialize()
        const allBarangays = barangayService.getBarangays()
        const poblacionBarangays = barangayService.getBarangays({ poblacionOnly: true })
        
        setBarangayStats({
          totalBarangays: allBarangays.length,
          poblacionCount: poblacionBarangays.length,
          ruralCount: allBarangays.length - poblacionBarangays.length
        })
      } catch (error) {}
    }

    initializeBarangayData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Barangay Coverage Stats */}
      {barangayStats && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">🗺️</span>
            <h4 className="font-medium text-gray-800">Geographic Coverage</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{barangayStats.totalBarangays}</div>
              <div className="text-gray-600">Total Barangays</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">{barangayStats.poblacionCount}</div>
              <div className="text-gray-600">Poblacion Areas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{barangayStats.ruralCount}</div>
              <div className="text-gray-600">Rural Areas</div>
            </div>
          </div>
        </div>
      )}

      {/* Calculator */}
      <RoutePlannerCalculator />
    </div>
  )
}