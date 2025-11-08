'use client'

import { useState, useEffect, useMemo } from 'react'

interface Incident {
  id: string
  incidentType: string
  description: string
  location: string
  coordinates: string
  plateNumber: string
  driverLicense: string
  status: string
  incidentDate: string
  createdAt: string
  reportedBy: {
    firstName: string
    lastName: string
  }
  handledBy?: {
    firstName: string
    lastName: string
  }
  ticketNumber?: string
  evidenceCount?: number
}

interface MapLocation {
  lat: number
  lng: number
}

interface Hotspot {
  id: string
  center: MapLocation
  incidents: Incident[]
  radius: number
  intensity: number
  commonTypes: string[]
  area: string
}

// Predefined areas in Basey, Samar with approximate coordinates
const BASEY_AREAS = [
  { name: 'Poblacion Market', lat: 11.2758, lng: 124.9628, zone: 'commercial' },
  { name: 'Elementary School Zone', lat: 11.2760, lng: 124.9625, zone: 'school' },
  { name: 'San Antonio Terminal', lat: 11.2755, lng: 124.9630, zone: 'transport' },
  { name: 'Guintigui-an Route', lat: 11.2750, lng: 124.9640, zone: 'highway' },
  { name: 'Basey Port Area', lat: 11.2765, lng: 124.9620, zone: 'port' },
  { name: 'National Highway Junction', lat: 11.2745, lng: 124.9635, zone: 'junction' },
  { name: 'Barangay Hall', lat: 11.2752, lng: 124.9632, zone: 'government' },
  { name: 'Public Market Extension', lat: 11.2759, lng: 124.9626, zone: 'commercial' },
  { name: 'Coastal Road', lat: 11.2770, lng: 124.9615, zone: 'coastal' },
  { name: 'Rural Highway', lat: 11.2740, lng: 124.9645, zone: 'rural' }
]

const OfflineIncidentMap = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'heatmap'>('grid')
  const [timeFilter, setTimeFilter] = useState('7') // days

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/incidents/enforcer', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIncidents(data.incidents || [])
      }
    } catch (error) {} finally {
      setLoading(false)
    }
  }

  const parseCoordinates = (coords: string): MapLocation | null => {
    try {
      if (coords && coords.includes(',')) {
        const [lat, lng] = coords.split(',').map(c => parseFloat(c.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
    } catch (error) {}
    return null
  }

  const findNearestArea = (coords: MapLocation): string => {
    let nearestArea = 'Unknown Area'
    let minDistance = Infinity

    BASEY_AREAS.forEach(area => {
      const distance = Math.sqrt(
        Math.pow(coords.lat - area.lat, 2) + Math.pow(coords.lng - area.lng, 2)
      )
      if (distance < minDistance) {
        minDistance = distance
        nearestArea = area.name
      }
    })

    return nearestArea
  }

  const hotspots = useMemo(() => {
    const filteredIncidents = incidents.filter(incident => {
      const coords = parseCoordinates(incident.coordinates)
      if (!coords) return false

      const daysAgo = parseInt(timeFilter)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysAgo)
      
      return new Date(incident.createdAt) >= cutoff
    })

    // Group incidents by proximity (simplified clustering)
    const clusters: { [key: string]: Incident[] } = {}
    
    filteredIncidents.forEach(incident => {
      const coords = parseCoordinates(incident.coordinates)
      if (!coords) return

      const area = findNearestArea(coords)
      if (!clusters[area]) {
        clusters[area] = []
      }
      clusters[area].push(incident)
    })

    // Convert clusters to hotspots
    return Object.entries(clusters)
      .filter(([area, incidents]) => incidents.length >= 2) // Minimum 2 incidents for hotspot
      .map(([area, incidents]) => {
        const coords = incidents
          .map(inc => parseCoordinates(inc.coordinates))
          .filter(Boolean) as MapLocation[]
        
        const center = {
          lat: coords.reduce((sum, c) => sum + c.lat, 0) / coords.length,
          lng: coords.reduce((sum, c) => sum + c.lng, 0) / coords.length
        }

        const violationCounts: { [key: string]: number } = {}
        incidents.forEach(inc => {
          violationCounts[inc.incidentType] = (violationCounts[inc.incidentType] || 0) + 1
        })

        const commonTypes = Object.entries(violationCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type]) => type)

        return {
          id: area.replace(/\s+/g, '_'),
          center,
          incidents,
          radius: Math.min(incidents.length * 0.001, 0.01), // Approximate radius
          intensity: incidents.length / parseInt(timeFilter) * 10, // Incidents per day * 10
          commonTypes,
          area
        }
      })
      .sort((a, b) => b.intensity - a.intensity)
  }, [incidents, timeFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-red-500'
      case 'INVESTIGATING': return 'bg-yellow-500'
      case 'RESOLVED': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 15) return 'bg-red-600'
    if (intensity >= 10) return 'bg-orange-500'
    if (intensity >= 5) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const getZoneIcon = (area: string) => {
    const areaInfo = BASEY_AREAS.find(a => area.includes(a.name))
    if (!areaInfo) return '📍'
    
    switch (areaInfo.zone) {
      case 'commercial': return '🏪'
      case 'school': return '🏫'
      case 'transport': return '🚌'
      case 'highway': return '🛣️'
      case 'port': return '⚓'
      case 'junction': return '🚦'
      case 'government': return '🏛️'
      case 'coastal': return '🌊'
      case 'rural': return '🌾'
      default: return '📍'
    }
  }

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing incident locations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📍 Offline Geographic Analysis</h2>
          <p className="text-gray-600">Location-based incident analysis • No internet required</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              🔲 Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'heatmap' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              🔥 Heat
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="text-2xl font-bold text-blue-600">{hotspots.length}</div>
          <div className="text-sm text-gray-600">Active Hotspots</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="text-2xl font-bold text-red-600">
            {incidents.filter(inc => parseCoordinates(inc.coordinates)).length}
          </div>
          <div className="text-sm text-gray-600">Located Incidents</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="text-2xl font-bold text-green-600">
            {hotspots.reduce((sum, h) => sum + h.incidents.length, 0)}
          </div>
          <div className="text-sm text-gray-600">Clustered Reports</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(hotspots.reduce((sum, h) => sum + h.intensity, 0) / hotspots.length) || 0}
          </div>
          <div className="text-sm text-gray-600">Avg Intensity</div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border"
              onClick={() => setSelectedHotspot(hotspot)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getZoneIcon(hotspot.area)}</span>
                  <h3 className="font-semibold text-gray-900">{hotspot.area}</h3>
                </div>
                <div className={`w-3 h-3 rounded-full ${getIntensityColor(hotspot.intensity)}`}></div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Incidents:</span>
                  <span className="font-medium">{hotspot.incidents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Intensity:</span>
                  <span className="font-medium">{hotspot.intensity.toFixed(1)}/day</span>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Common Types:</div>
                <div className="flex flex-wrap gap-1">
                  {hotspot.commonTypes.slice(0, 2).map((type, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Hotspot Analysis Report</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {hotspots.map((hotspot, index) => (
              <div key={hotspot.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium">
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getZoneIcon(hotspot.area)} {hotspot.area}</h4>
                      <p className="text-sm text-gray-500">
                        {hotspot.incidents.length} incidents • {hotspot.intensity.toFixed(1)} per day
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedHotspot(hotspot)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'heatmap' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Intensity Heatmap</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {BASEY_AREAS.map((area) => {
              const hotspot = hotspots.find(h => h.area.includes(area.name))
              const intensity = hotspot ? hotspot.intensity : 0
              
              return (
                <div
                  key={area.name}
                  className={`p-4 rounded-lg text-white text-center ${
                    intensity === 0 ? 'bg-gray-300' : getIntensityColor(intensity)
                  }`}
                >
                  <div className="text-lg mb-1">{getZoneIcon(area.name)}</div>
                  <div className="text-xs font-medium">{area.name}</div>
                  <div className="text-lg font-bold mt-1">
                    {hotspot ? hotspot.incidents.length : 0}
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="mt-6 flex items-center justify-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span>No Activity</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Low (1-4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Medium (5-9)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span>High (10-14)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span>Critical (15+)</span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Hotspot Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {getZoneIcon(selectedHotspot.area)} {selectedHotspot.area}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Hotspot Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Incidents:</span>
                    <span className="font-medium">{selectedHotspot.incidents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily Average:</span>
                    <span className="font-medium">{selectedHotspot.intensity.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Period:</span>
                    <span className="font-medium">{timeFilter} days</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Status Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(
                    selectedHotspot.incidents.reduce((acc, inc) => {
                      acc[inc.status] = (acc[inc.status] || 0) + 1
                      return acc
                    }, {} as Record<string, number>)
                  ).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded ${getStatusColor(status)}`}></div>
                        <span>{status}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Recent Incidents</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {selectedHotspot.incidents
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{incident.incidentType}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {new Date(incident.incidentDate).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(incident.status)} text-white`}>
                        {incident.status}
                      </span>
                    </div>
                  ))}
              </div>
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
      )}

      {hotspots.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Hotspots Detected</h3>
          <p className="text-gray-600">
            No incident clusters found in the selected time period. This indicates good area coverage or low incident concentration.
          </p>
        </div>
      )}
    </div>
  )
}

export default OfflineIncidentMap