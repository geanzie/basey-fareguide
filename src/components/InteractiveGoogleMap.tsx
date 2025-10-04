'use client'

import { useState, useEffect, useRef } from 'react'

interface MapProps {
  origin?: [number, number]
  destination?: [number, number]
  onRouteCalculated?: (distance: number, duration: number) => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

const InteractiveGoogleMap = ({ origin, destination, onRouteCalculated }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [directionsService, setDirectionsService] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string>('')

  // Load Google Maps JavaScript API
  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap()
        return
      }

      // Create script element to load Google Maps
      const script = document.createElement('script')
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      
      if (!apiKey) {
        setError('Google Maps API key not found')
        return
      }

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&callback=initMap`
      script.async = true
      script.defer = true
      
      // Set up the callback function
      window.initMap = initializeMap
      
      script.onerror = () => {
        setError('Failed to load Google Maps')
      }

      document.head.appendChild(script)
    }

    const initializeMap = () => {
      if (!mapRef.current || !window.google) return

      try {
        // Center on Basey town center (José Rizal Monument)
        const baseyCenter = { lat: 11.280182, lng: 125.06918 }
        
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          zoom: 13,
          center: baseyCenter,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi.business',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            },
            {
              featureType: 'poi.park',
              elementType: 'labels.text',
              stylers: [{ visibility: 'on' }]
            }
          ],
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
        })

        const directionsServiceInstance = new window.google.maps.DirectionsService()
        const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#2563eb',
            strokeWeight: 4,
            strokeOpacity: 0.8
          },
          markerOptions: {
            draggable: false
          }
        })

        directionsRendererInstance.setMap(mapInstance)

        setMap(mapInstance)
        setDirectionsService(directionsServiceInstance)
        setDirectionsRenderer(directionsRendererInstance)
        setIsLoaded(true)
        setError('')

        // Add a marker for Basey Center (KM 0)
        new window.google.maps.Marker({
          position: baseyCenter,
          map: mapInstance,
          title: 'José Rizal Monument (Basey Center - KM 0)',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new window.google.maps.Size(32, 32)
          }
        })

      } catch (err) {
        console.error('Error initializing map:', err)
        setError('Error initializing map')
      }
    }

    loadGoogleMaps()

    // Cleanup function
    return () => {
      if (window.initMap) {
        window.initMap = undefined as any
      }
    }
  }, [])

  // Update route when origin/destination changes
  useEffect(() => {
    if (!map || !directionsService || !directionsRenderer || !origin || !destination) {
      return
    }

    const calculateAndDisplayRoute = () => {
      const request = {
        origin: new window.google.maps.LatLng(origin[0], origin[1]),
        destination: new window.google.maps.LatLng(destination[0], destination[1]),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
      }

      directionsService.route(request, (result: any, status: string) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result)
          
          // Extract route information
          const route = result.routes[0]
          if (route && route.legs[0]) {
            const leg = route.legs[0]
            const distance = leg.distance.value / 1000 // Convert to kilometers
            const duration = leg.duration.value / 60 // Convert to minutes
            
            if (onRouteCalculated) {
              onRouteCalculated(distance, duration)
            }
          }
        } else {
          console.error('Directions request failed due to:', status)
          setError(`Route calculation failed: ${status}`)
        }
      })
    }

    calculateAndDisplayRoute()
  }, [map, directionsService, directionsRenderer, origin, destination, onRouteCalculated])

  if (error) {
    return (
      <div className="h-96 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-red-600">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Map Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        className="h-96 w-full rounded-lg shadow-sm border border-gray-200"
        style={{ minHeight: '400px' }}
      >
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-2xl">🗺️</span>
              </div>
              <p className="text-gray-600 font-medium">Loading Google Maps...</p>
              <div className="mt-2">
                <div className="inline-flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {isLoaded && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center text-sm text-blue-800">
            <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center mr-2">
              <span className="text-xs">ℹ️</span>
            </span>
            <span>Interactive map loaded • Click and drag to explore • Route will appear when locations are selected</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default InteractiveGoogleMap