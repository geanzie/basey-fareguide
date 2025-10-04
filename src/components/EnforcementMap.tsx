'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { GoogleMap, LoadScript, Marker, HeatmapLayer, InfoWindow, Circle } from '@react-google-maps/api'

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

interface IncidentMarker extends MapLocation {
  incident: Incident
  priority: 'high' | 'medium' | 'normal'
}

interface Hotspot {
  id: string
  center: MapLocation
  radius: number
  intensity: number
  incidentCount: number
  commonTypes: string[]
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["visualization", "places"]

const EnforcementMap = () => {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showHotspots, setShowHotspots] = useState(true)
  const [dateRange, setDateRange] = useState('7') // days
  const [violationFilter, setViolationFilter] = useState('all')
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mapError, setMapError] = useState<string>('')

  // Basey Municipality coordinates
  const baseyCenter: MapLocation = {
    lat: 11.2758,
    lng: 124.9628
  }

  const mapOptions = {
    zoom: 13,
    center: baseyCenter,
    mapTypeId: 'roadmap' as google.maps.MapTypeId,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }

  useEffect(() => {
    fetchIncidents()
  }, [dateRange, violationFilter])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/incidents/enforcer?days=${dateRange}&filter=${violationFilter}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIncidents(data.incidents.filter((incident: Incident) => incident.coordinates))
      }
    } catch (error) {
      console.error('Error fetching incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseCoordinates = (coordString: string): MapLocation | null => {
    try {
      const [lat, lng] = coordString.split(',').map(coord => parseFloat(coord.trim()))
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng }
      }
    } catch (error) {
      console.error('Error parsing coordinates:', coordString, error)
    }
    return null
  }

  const getIncidentPriority = (incident: Incident): 'high' | 'medium' | 'normal' => {
    const now = new Date()
    const createdAt = new Date(incident.createdAt)
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursDiff > 48) return 'high'
    if (hoursDiff > 24) return 'medium'
    return 'normal'
  }

  const getMarkerIcon = (incident: Incident) => {
    const priority = getIncidentPriority(incident)
    const baseUrl = 'http://maps.google.com/mapfiles/ms/icons/'
    
    const statusColors = {
      'PENDING': 'red',
      'INVESTIGATING': 'yellow',
      'RESOLVED': 'green'
    }
    
    const color = statusColors[incident.status as keyof typeof statusColors] || 'red'
    
    // Check if google maps API is available
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      return {
        url: `${baseUrl}${color}-dot.png`,
        scaledSize: new window.google.maps.Size(
          priority === 'high' ? 40 : priority === 'medium' ? 35 : 30,
          priority === 'high' ? 40 : priority === 'medium' ? 35 : 30
        )
      }
    }
    
    // Fallback for when google maps isn't loaded yet
    return {
      url: `${baseUrl}${color}-dot.png`,
      scaledSize: { 
        width: priority === 'high' ? 40 : priority === 'medium' ? 35 : 30, 
        height: priority === 'high' ? 40 : priority === 'medium' ? 35 : 30 
      }
    }
  }

  const incidentMarkers: IncidentMarker[] = useMemo(() => {
    return incidents
      .map(incident => {
        const coords = parseCoordinates(incident.coordinates)
        if (!coords) return null
        
        return {
          ...coords,
          incident,
          priority: getIncidentPriority(incident)
        }
      })
      .filter((marker): marker is IncidentMarker => marker !== null)
  }, [incidents])

  const heatmapData = useMemo(() => {
    if (!mapLoaded) return []
    
    return incidentMarkers.map(marker => ({
      location: new google.maps.LatLng(marker.lat, marker.lng),
      weight: marker.priority === 'high' ? 3 : marker.priority === 'medium' ? 2 : 1
    }))
  }, [incidentMarkers, mapLoaded])

  // Calculate hotspots using clustering algorithm
  const hotspots: Hotspot[] = useMemo(() => {
    if (incidentMarkers.length === 0) return []

    const clusters: IncidentMarker[][] = []
    const processed = new Set<number>()
    const CLUSTER_RADIUS = 0.003 // Approximately 300m in degrees

    incidentMarkers.forEach((marker, i) => {
      if (processed.has(i)) return

      const cluster = [marker]
      processed.add(i)

      incidentMarkers.forEach((otherMarker, j) => {
        if (i === j || processed.has(j)) return

        const distance = Math.sqrt(
          Math.pow(marker.lat - otherMarker.lat, 2) +
          Math.pow(marker.lng - otherMarker.lng, 2)
        )

        if (distance <= CLUSTER_RADIUS) {
          cluster.push(otherMarker)
          processed.add(j)
        }
      })

      if (cluster.length >= 2) {
        clusters.push(cluster)
      }
    })

    return clusters.map((cluster, index) => {
      const centerLat = cluster.reduce((sum, marker) => sum + marker.lat, 0) / cluster.length
      const centerLng = cluster.reduce((sum, marker) => sum + marker.lng, 0) / cluster.length
      
      const types = cluster.map(marker => marker.incident.incidentType)
      const uniqueTypes = Array.from(new Set(types))
      const commonTypes = uniqueTypes.slice(0, 3)

      return {
        id: `hotspot-${index}`,
        center: { lat: centerLat, lng: centerLng },
        radius: CLUSTER_RADIUS * 111320, // Convert to meters
        intensity: cluster.length,
        incidentCount: cluster.length,
        commonTypes
      }
    })
  }, [incidentMarkers])

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
    setMapLoaded(true)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
    setMapLoaded(false)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="bg-white p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Time Range:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Violation Type:</span>
          <select
            value={violationFilter}
            onChange={(e) => setViolationFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="all">All Types</option>
            <option value="FARE_OVERCHARGE">Fare Overcharge</option>
            <option value="FARE_UNDERCHARGE">Fare Undercharge</option>
            <option value="RECKLESS_DRIVING">Reckless Driving</option>
            <option value="VEHICLE_VIOLATION">Vehicle Violation</option>
            <option value="ROUTE_VIOLATION">Route Violation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Heatmap</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={(e) => setShowHotspots(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Hotspots</span>
          </label>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>📍 {incidentMarkers.length} incidents mapped</span>
          <span>🔥 {hotspots.length} hotspots detected</span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <LoadScript
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyA9QraryTkKFAYQw1ipSJEalXhLVjuF92o'}
          libraries={libraries}
          loadingElement={
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading map...</p>
              </div>
            </div>
          }
          onError={(error) => {
            console.error('Google Maps API Error:', error)
          }}
        >
          <GoogleMap
            mapContainerStyle={{ height: '100%', width: '100%' }}
            options={mapOptions}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            {/* Incident Markers */}
            {incidentMarkers.map((marker, index) => (
              <Marker
                key={`incident-${marker.incident.id}`}
                position={{ lat: marker.lat, lng: marker.lng }}
                icon={getMarkerIcon(marker.incident)}
                onClick={() => setSelectedIncident(marker.incident)}
                title={`${getIncidentTypeLabel(marker.incident.incidentType)} - ${marker.incident.plateNumber || 'No plate'}`}
              />
            ))}

            {/* Heatmap */}
            {showHeatmap && mapLoaded && (
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

            {/* Hotspots */}
            {showHotspots && hotspots.map((hotspot) => (
              <Circle
                key={hotspot.id}
                center={hotspot.center}
                radius={hotspot.radius}
                options={{
                  fillColor: '#ff0000',
                  fillOpacity: 0.15,
                  strokeColor: '#ff0000',
                  strokeOpacity: 0.8,
                  strokeWeight: 2
                }}
              />
            ))}

            {/* Info Window */}
            {selectedIncident && (
              <InfoWindow
                position={parseCoordinates(selectedIncident.coordinates)!}
                onCloseClick={() => setSelectedIncident(null)}
              >
                <div className="max-w-sm">
                  <div className="font-semibold text-lg mb-2">
                    {getIncidentTypeLabel(selectedIncident.incidentType)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Location:</span> {selectedIncident.location}
                    </div>
                    
                    {selectedIncident.plateNumber && (
                      <div>
                        <span className="font-medium">Plate:</span> {selectedIncident.plateNumber}
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        selectedIncident.status === 'PENDING' ? 'bg-red-100 text-red-800' :
                        selectedIncident.status === 'INVESTIGATING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {selectedIncident.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-medium">Reported:</span> {formatDate(selectedIncident.createdAt)}
                    </div>
                    
                    <div className="text-gray-600">
                      {selectedIncident.description.length > 100 
                        ? `${selectedIncident.description.substring(0, 100)}...`
                        : selectedIncident.description
                      }
                    </div>

                    {selectedIncident.ticketNumber && (
                      <div>
                        <span className="font-medium">Ticket:</span> {selectedIncident.ticketNumber}
                      </div>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>

        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading incidents...</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 p-3 border-t border-gray-200">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center space-x-4">
            <span className="font-medium text-gray-700">Status:</span>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Investigating</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Resolved</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="font-medium text-gray-700">Priority:</span>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded-full bg-gray-300"></div>
              <span>Normal</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-5 h-5 rounded-full bg-gray-600"></div>
              <span>High</span>
            </div>
          </div>

          {showHotspots && (
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Hotspots:</span>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 rounded-full border-2 border-red-500 bg-red-200"></div>
                <span>High incident areas</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnforcementMap