'use client'

import { useState, useEffect, useRef } from 'react'
import { barangayService } from '../lib/barangayService'
import { BarangayInfo } from '../utils/barangayBoundaries'

interface EnhancedRouteMapProps {
  origin?: { lat: number; lng: number; name?: string }
  destination?: { lat: number; lng: number; name?: string }
  route?: { lat: number; lng: number }[]
  showBarangayBoundaries?: boolean
  onBarangayClick?: (barangay: BarangayInfo) => void
  className?: string
}

export default function EnhancedRouteMap({
  origin,
  destination,
  route,
  showBarangayBoundaries = true,
  onBarangayClick,
  className = 'w-full h-96'
}: EnhancedRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [barangayPolygons, setBarangayPolygons] = useState<google.maps.Polygon[]>([])
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayInfo | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  // Initialize Google Maps
  useEffect(() => {
    const initializeMap = async () => {
      try {
        if (!window.google?.maps) {
          throw new Error('Google Maps not loaded')
        }

        if (!mapRef.current) return

        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 11.2754, lng: 125.0689 }, // Basey Municipality center
          zoom: 12,
          styles: [
            {
              featureType: 'administrative.locality',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#444444' }]
            },
            {
              featureType: 'poi',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#757575' }]
            }
          ]
        })

        setMap(mapInstance)
        setIsLoaded(true)

        // Load barangay boundaries if enabled
        if (showBarangayBoundaries) {
          await loadBarangayBoundaries(mapInstance)
        }

      } catch (error) {
        console.error('Error initializing map:', error)
        setMapError('Failed to initialize map. Please check your internet connection.')
      }
    }

    initializeMap()
  }, [showBarangayBoundaries])

  // Load barangay boundaries as polygons
  const loadBarangayBoundaries = async (mapInstance: google.maps.Map) => {
    try {
      await barangayService.initialize()
      const geoJsonData = barangayService.getGeoJSONData()
      
      const polygons: google.maps.Polygon[] = []

      geoJsonData.features.forEach((feature) => {
        const barangayName = feature.properties.Name
        const isPoblacion = feature.properties.POB === 'POB'
        
        // Create polygon for each barangay
        const coordinates = feature.geometry.coordinates[0].map(([lng, lat]) => ({
          lat: lat,
          lng: lng
        }))

        const polygon = new google.maps.Polygon({
          paths: coordinates,
          strokeColor: isPoblacion ? '#3B82F6' : '#10B981',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: isPoblacion ? '#DBEAFE' : '#D1FAE5',
          fillOpacity: 0.35,
          clickable: true
        })

        polygon.setMap(mapInstance)
        polygons.push(polygon)

        // Add click listener for barangay selection
        polygon.addListener('click', (event: google.maps.PolyMouseEvent) => {
          const barangay = barangayService.getBarangay(barangayName)
          if (barangay) {
            setSelectedBarangay(barangay)
            if (onBarangayClick) {
              onBarangayClick(barangay)
            }

            // Show info window
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h4 class="font-bold text-sm">${barangay.name}</h4>
                  <p class="text-xs text-gray-600">Code: ${barangay.code}</p>
                  <p class="text-xs ${barangay.isPoblacion ? 'text-blue-600' : 'text-green-600'}">
                    ${barangay.isPoblacion ? '🏛️ Poblacion' : '🌾 Rural'}
                  </p>
                </div>
              `,
              position: event.latLng
            })
            
            infoWindow.open(mapInstance)
          }
        })

        // Add barangay label
        const label = new google.maps.Marker({
          position: {
            lat: feature.geometry.coordinates[0].reduce((sum, coord) => sum + coord[1], 0) / feature.geometry.coordinates[0].length,
            lng: feature.geometry.coordinates[0].reduce((sum, coord) => sum + coord[0], 0) / feature.geometry.coordinates[0].length
          },
          map: mapInstance,
          label: {
            text: barangayName,
            color: isPoblacion ? '#1E40AF' : '#059669',
            fontSize: '10px',
            fontWeight: 'bold'
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0
          }
        })
      })

      setBarangayPolygons(polygons)

    } catch (error) {
      console.error('Error loading barangay boundaries:', error)
    }
  }

  // Add markers for origin and destination
  useEffect(() => {
    if (!map || !isLoaded) return

    // Clear existing markers
    // (In a real implementation, you'd track markers to remove them)

    if (origin) {
      new google.maps.Marker({
        position: origin,
        map: map,
        title: origin.name || 'Origin',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      })
    }

    if (destination) {
      new google.maps.Marker({
        position: destination,
        map: map,
        title: destination.name || 'Destination',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        }
      })
    }

    // Fit map to show both points
    if (origin && destination) {
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(origin)
      bounds.extend(destination)
      map.fitBounds(bounds)
    }
  }, [map, isLoaded, origin, destination])

  // Draw route polyline
  useEffect(() => {
    if (!map || !isLoaded || !route || route.length < 2) return

    const routePath = new google.maps.Polyline({
      path: route,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 3
    })

    routePath.setMap(map)

    // Fit map to route
    const bounds = new google.maps.LatLngBounds()
    route.forEach(point => bounds.extend(point))
    map.fitBounds(bounds)

  }, [map, isLoaded, route])

  if (mapError) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`}>
        <div className="text-center p-6">
          <div className="text-2xl mb-2">🗺️</div>
          <div className="text-gray-600 font-medium">Map Unavailable</div>
          <div className="text-sm text-gray-500 mt-1">{mapError}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${className} bg-gray-100 rounded-lg overflow-hidden relative`}>
        <div ref={mapRef} className="w-full h-full" />
        
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <div className="text-sm text-gray-600">Loading enhanced map...</div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {showBarangayBoundaries && isLoaded && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">Map Legend</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 bg-blue-100 rounded"></div>
              <span>Poblacion Barangays</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-green-500 bg-green-100 rounded"></div>
              <span>Rural Barangays</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Origin Point</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Destination Point</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Barangay Info */}
      {selectedBarangay && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Selected Barangay</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700">Name:</div>
              <div className="text-blue-700">{selectedBarangay.name}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Code:</div>
              <div className="text-blue-700">{selectedBarangay.code}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Type:</div>
              <div className={selectedBarangay.isPoblacion ? 'text-blue-700' : 'text-green-700'}>
                {selectedBarangay.isPoblacion ? '🏛️ Poblacion' : '🌾 Rural'}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Center:</div>
              <div className="text-gray-600 text-xs">
                {selectedBarangay.center[1].toFixed(4)}, {selectedBarangay.center[0].toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}