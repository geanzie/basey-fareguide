'use client'

import { useState, useEffect } from 'react'

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

const MapFallback = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-red-100 text-red-800'
      case 'INVESTIGATING': return 'bg-yellow-100 text-yellow-800'
      case 'RESOLVED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const parseCoordinates = (coords: string) => {
    try {
      if (coords.includes(',')) {
        const [lat, lng] = coords.split(',').map(c => parseFloat(c.trim()))
        return { lat, lng }
      }
    } catch (error) {}
    return null
  }

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incidents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">📍 Geographic Incidents View</h3>
          <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-lg">
            ⚠️ Map unavailable - showing location data
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Incidents with location coordinates ({incidents.filter(inc => inc.coordinates).length} of {incidents.length})
        </p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {incidents.filter(inc => inc.coordinates).map((incident) => {
          const coords = parseCoordinates(incident.coordinates)
          return (
            <div key={incident.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{incident.incidentType}</h4>
                  <p className="text-sm text-gray-600">{incident.location}</p>
                  {coords && (
                    <p className="text-xs text-blue-600">
                      📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(incident.status)}`}>
                  {incident.status}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div>🚗 <strong>Plate:</strong> {incident.plateNumber}</div>
                <div>📅 <strong>Date:</strong> {new Date(incident.incidentDate).toLocaleDateString()}</div>
                <div>👤 <strong>Reported by:</strong> {incident.reportedBy.firstName} {incident.reportedBy.lastName}</div>
                {incident.evidenceCount && incident.evidenceCount > 0 && (
                  <div>📎 <strong>Evidence:</strong> {incident.evidenceCount} file(s)</div>
                )}
              </div>
              
              <div className="mt-2 text-sm text-gray-500">
                <p className="line-clamp-2">{incident.description}</p>
              </div>
            </div>
          )
        })}
        
        {incidents.filter(inc => inc.coordinates).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>📍 No incidents with location data available</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 text-sm mb-1">💡 Geographic Insights</h4>
        <div className="text-xs text-blue-800 space-y-1">
          <div>• {incidents.filter(inc => inc.status === 'PENDING').length} pending incidents need location verification</div>
          <div>• {incidents.filter(inc => inc.coordinates && inc.status === 'INVESTIGATING').length} active investigations with GPS data</div>
          <div>• Map functionality will be restored when Google Maps API is available</div>
        </div>
      </div>
    </div>
  )
}

export default MapFallback