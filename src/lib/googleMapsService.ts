import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js'

// Server-side Google Maps client for API calls
export const googleMapsClient = new Client({})

// Types for our application
export interface LocationCoordinates {
  lat: number
  lng: number
}

export interface RouteData {
  distance: {
    text: string
    value: number // in meters
  }
  duration: {
    text: string
    value: number // in seconds
  }
  polyline?: string
}

export interface GoogleMapsRouteResult {
  distance: number // in kilometers
  duration: number // in minutes
  fare: number
  breakdown: {
    baseFare: number
    additionalDistance: number
    additionalFare: number
  }
  routeDetails: {
    estimatedTime: string
    roadConditions: string
    terrainFactors: string[]
    polyline?: string
  }
}

// Convert coordinates to Google Maps format
export const convertToGoogleMapsCoords = (coords: [number, number]): LocationCoordinates => ({
  lat: coords[0],
  lng: coords[1]
})

// Calculate fare based on Google Maps distance
export const calculateFareFromGoogleMaps = (distanceInMeters: number): {
  distance: number
  fare: number
  breakdown: {
    baseFare: number
    additionalDistance: number
    additionalFare: number
  }
} => {
  const distanceInKm = distanceInMeters / 1000
  const baseFare = 15 // Municipal Ordinance 105 Series of 2023
  const baseDistance = 3 // First 3 kilometers
  const additionalRate = 3 // ₱3 per additional kilometer

  let fare = baseFare
  let additionalDistance = 0
  let additionalFare = 0

  if (distanceInKm > baseDistance) {
    additionalDistance = distanceInKm - baseDistance
    additionalFare = Math.ceil(additionalDistance) * additionalRate
    fare += additionalFare
  }

  return {
    distance: distanceInKm,
    fare,
    breakdown: {
      baseFare,
      additionalDistance,
      additionalFare
    }
  }
}

// Enhanced route details generation
export const generateEnhancedRouteDetails = (
  distance: number,
  duration: number,
  fromLocation: string,
  toLocation: string
) => {
  const hours = Math.floor(duration / 60)
  const minutes = Math.round(duration % 60)
  const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  const terrainFactors = []
  
  // Specific route conditions based on Basey locations
  if (fromLocation.includes('Sohoton') || toLocation.includes('Sohoton')) {
    terrainFactors.push('Coastal route with scenic views')
    terrainFactors.push('Final stretch requires boat access to cave')
    terrainFactors.push('Unpaved sections near tourist area')
  }
  
  // Routes through poblacion
  if ((fromLocation.includes('Poblacion') || toLocation.includes('Poblacion')) && 
      !(fromLocation.includes('Sohoton') || toLocation.includes('Sohoton'))) {
    terrainFactors.push('Route passes through Basey town center')
    terrainFactors.push('Paved roads in poblacion area')
  }
  
  // Rural routes
  if (distance > 10) {
    terrainFactors.push('Hilly terrain with elevation changes')
    terrainFactors.push('Some unpaved barangay road sections')
  }
  
  // River crossings (common in Samar)
  if (distance > 8) {
    terrainFactors.push('Multiple river/creek crossings')
  }
  
  // Weather considerations
  if (distance > 15) {
    terrainFactors.push('Route affected by weather conditions')
    terrainFactors.push('May require 4WD during rainy season')
  }
  
  // Bridge conditions
  if (distance > 5) {
    terrainFactors.push('Concrete bridges in good condition')
  }

  // Road conditions based on distance and locations
  const roadConditions = (() => {
    if (fromLocation.includes('Sohoton') || toLocation.includes('Sohoton')) {
      return 'Poor to Fair (Coastal access road, some unpaved)'
    } else if (fromLocation.includes('Poblacion') && toLocation.includes('Poblacion')) {
      return 'Good (Paved poblacion streets)'
    } else if (distance > 20) {
      return 'Fair to Good (Provincial road network)'
    } else {
      return 'Fair (Concrete barangay roads, some rough sections)'
    }
  })()

  return {
    estimatedTime: timeString,
    roadConditions,
    terrainFactors: terrainFactors.length > 0 ? terrainFactors : ['Standard municipal road with concrete surface']
  }
}