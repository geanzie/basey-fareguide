'use client'

import { useState, useEffect, useRef } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, HeatmapLayer } from '@react-google-maps/api'

interface IncidentLocation {
  id: string
  incidentType: string
  description: string
  location: string
  coordinates: {
    lat: number
    lng: number
  }
  status: string
  createdAt: string
  plateNumber?: string
  ticketNumber?: string
}

interface IncidentMapProps {
  incidents: IncidentLocation[]
  onIncidentSelect?: (incident: IncidentLocation) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '12px'
}

// Basey, Samar center coordinates
const baseyCenter = {
  lat: 11.2757,
  lng: 124.9628
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: true,
  streetViewControl: true,
  rotateControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
}

const IncidentMap: React.FC<IncidentMapProps> = ({ incidents, onIncidentSelect }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['visualization']
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentLocation | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const onLoad = (map: google.maps.Map) => {
    setMap(map)
  }

  const onUnmount = () => {
    setMap(null)
  }

  const getMarkerIcon = (incident: IncidentLocation) => {
    const colors = {
      'FARE_OVERCHARGE': '#ef4444', // red
      'FARE_UNDERCHARGE': '#f97316', // orange
      'RECKLESS_DRIVING': '#dc2626', // dark red
      'VEHICLE_VIOLATION': '#7c3aed', // purple
      'ROUTE_VIOLATION': '#2563eb', // blue
      'OTHER': '#6b7280' // gray
    }
    
    const statusOpacity = {
      'PENDING': 1.0,
      'INVESTIGATING': 0.7,
      'RESOLVED': 0.4,
      'DISMISSED': 0.3
    }

    const color = colors[incident.incidentType as keyof typeof colors] || '#6b7280'
    const opacity = statusOpacity[incident.status as keyof typeof statusOpacity] || 1.0

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: opacity,
      stroke: '#ffffff',
      strokeWeight: 2,
      scale: 8
    }
  }

  const getIncidentTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'FARE_OVERCHARGE': 'Fare Overcharge',
      'FARE_UNDERCHARGE': 'Fare Undercharge',
      'RECKLESS_DRIVING': 'Reckless Driving',
      'VEHICLE_VIOLATION': 'Vehicle Violation',
      'ROUTE_VIOLATION': 'Route Violation',
      'OTHER': 'Other'
    }
    return labels[type] || type
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredIncidents = incidents.filter(incident => {
    const statusMatch = filterStatus === 'all' || incident.status === filterStatus
    const typeMatch = filterType === 'all' || incident.incidentType === filterType
    return statusMatch && typeMatch
  })

  // Prepare heatmap data
  const heatmapData = filteredIncidents.map(incident => ({
    location: new google.maps.LatLng(incident.coordinates.lat, incident.coordinates.lng),
    weight: incident.status === 'PENDING' ? 3 : incident.status === 'INVESTIGATING' ? 2 : 1
  }))

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Map Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">Incident Map</h3>
            <span className="text-sm text-gray-600">
              {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''} shown
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1"
            >
              <option value="all">All Types</option>
              <option value="FARE_OVERCHARGE">Fare Overcharge</option>
              <option value="FARE_UNDERCHARGE">Fare Undercharge</option>
              <option value="RECKLESS_DRIVING">Reckless Driving</option>
              <option value="VEHICLE_VIOLATION">Vehicle Violation</option>
              <option value="ROUTE_VIOLATION">Route Violation</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Heatmap Toggle */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                showHeatmap
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🔥 Heatmap
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-gray-700">Legend:</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Fare/Reckless</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Vehicle</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Route</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Other</span>
          </div>
          <span className="text-gray-500 ml-4">• Opacity indicates status (bright = pending, dim = resolved)</span>
        </div>
      </div>

      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={baseyCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Heatmap Layer */}
        {showHeatmap && map && (
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 50,
              opacity: 0.6,
              gradient: [
                'rgba(0, 255, 255, 0)',
                'rgba(0, 255, 255, 1)',
                'rgba(0, 191, 255, 1)',
                'rgba(0, 127, 255, 1)',
                'rgba(0, 63, 255, 1)',
                'rgba(0, 0, 255, 1)',
                'rgba(0, 0, 223, 1)',
                'rgba(0, 0, 191, 1)',
                'rgba(0, 0, 159, 1)',
                'rgba(0, 0, 127, 1)',
                'rgba(63, 0, 91, 1)',
                'rgba(127, 0, 63, 1)',
                'rgba(191, 0, 31, 1)',
                'rgba(255, 0, 0, 1)'
              ]
            }}
          />
        )}

        {/* Individual Markers */}
        {!showHeatmap && filteredIncidents.map((incident) => (
          <Marker
            key={incident.id}
            position={incident.coordinates}
            icon={getMarkerIcon(incident)}
            onClick={() => {
              setSelectedIncident(incident)
              if (onIncidentSelect) {
                onIncidentSelect(incident)
              }
            }}
          />
        ))}

        {/* Info Window */}
        {selectedIncident && (
          <InfoWindow
            position={selectedIncident.coordinates}
            onCloseClick={() => setSelectedIncident(null)}
          >
            <div className="p-3 max-w-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">
                  {getIncidentTypeLabel(selectedIncident.incidentType)}
                </h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  selectedIncident.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  selectedIncident.status === 'INVESTIGATING' ? 'bg-blue-100 text-blue-800' :
                  selectedIncident.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedIncident.status.toLowerCase()}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <p><strong>Location:</strong> {selectedIncident.location}</p>
                {selectedIncident.plateNumber && (
                  <p><strong>Plate:</strong> {selectedIncident.plateNumber}</p>
                )}
                <p><strong>Date:</strong> {formatDate(selectedIncident.createdAt)}</p>
                {selectedIncident.ticketNumber && (
                  <p><strong>Ticket:</strong> {selectedIncident.ticketNumber}</p>
                )}
              </div>
              
              <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700">
                {selectedIncident.description.length > 100
                  ? selectedIncident.description.substring(0, 100) + '...'
                  : selectedIncident.description
                }
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}

export default IncidentMap