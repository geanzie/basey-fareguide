import { NextRequest, NextResponse } from 'next/server';
import { BASEY_CENTER } from '@/utils/baseyCenter';

// Enhanced GPS distance calculation with road network simulation
function calculateRoadBasedDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number,
  originName: string,
  destinationName: string
): number {
  // Base Haversine distance calculation
  const R = 6371000 // Earth's radius in meters
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180
  const deltaLatRad = (lat2 - lat1) * Math.PI / 180
  const deltaLngRad = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  let roadDistance = R * c / 1000 // Convert to kilometers

  // Apply realistic road network factors based on Basey Municipality geography
  const roadFactor = calculateRoadNetworkFactor(originName, destinationName, roadDistance)
  
  return (roadDistance * roadFactor) * 1000 // Return in meters
}

// Calculate road network factor based on actual Basey geography and infrastructure
function calculateRoadNetworkFactor(origin: string, destination: string, directDistance: number): number {
  let factor = 1.0

  // Base road network factor (roads don't go straight)
  if (origin.includes('Poblacion') && destination.includes('Poblacion')) {
    // Within town center - good road grid, minimal deviation
    factor = 1.15
  } else if (origin.includes('Poblacion') || destination.includes('Poblacion')) {
    // One endpoint in town center - moderate deviation
    factor = 1.25
  } else {
    // Rural to rural - more winding roads
    factor = 1.35
  }

  // Special geographic considerations for Basey
  
  // Sohoton area requires coastal route + boat access
  if (origin.includes('Sohoton') || destination.includes('Sohoton')) {
    factor *= 1.4 // Coastal roads are more winding
    if (origin.includes('Caves') || destination.includes('Caves')) {
      factor += 0.2 // Additional boat/walking access to caves
    }
  }

  // Routes crossing major rivers (Basey has several river systems)
  if (directDistance > 8) {
    factor *= 1.1 // Longer routes likely cross rivers, requiring detours to bridges
  }

  // Mountain/hilly terrain in northern barangays
  const mountainousAreas = ['Baloog', 'Mabini', 'Manlilinab', 'Cancaiyas', 'Inuntan']
  if (mountainousAreas.some(area => origin.includes(area) || destination.includes(area))) {
    factor *= 1.2 // Mountain roads are more winding
  }

  // Coastal routes (western barangays)
  const coastalAreas = ['Tinaogan', 'Cambayan', 'Amandayehan', 'San Antonio']
  if (coastalAreas.some(area => origin.includes(area) || destination.includes(area))) {
    factor *= 1.15 // Coastal roads follow the shoreline
  }

  // Very long distances (likely using provincial roads)
  if (directDistance > 20) {
    factor *= 1.05 // Provincial roads are more direct but still not straight
  }

  // Ensure reasonable bounds
  return Math.max(1.1, Math.min(factor, 2.0))
}

// Haversine formula for calculating distance between two coordinates
function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180
  const deltaLatRad = (lat2 - lat1) * Math.PI / 180
  const deltaLngRad = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Return distance in meters
}

// Calculate fare based on distance
function calculateFare(distanceInKm: number) {
  const baseFare = 15.00 // First 3km
  const baseDistance = 3.0
  const additionalRate = 3.00 // Per additional km

  if (distanceInKm <= baseDistance) {
    return {
      totalFare: baseFare,
      baseFare: baseFare,
      additionalDistance: 0,
      additionalFare: 0
    }
  }

  const additionalDistance = distanceInKm - baseDistance
  const additionalFare = additionalDistance * additionalRate
  const totalFare = baseFare + additionalFare

  return {
    totalFare: totalFare,
    baseFare: baseFare,
    additionalDistance: additionalDistance,
    additionalFare: additionalFare
  }
}

// Validate coordinates are within Basey bounds
function validateBaseyCoordinates(coords: [number, number]): boolean {
  const [lat, lng] = coords
  
  // Basey Municipality approximate bounds
  const bounds = {
    north: 11.35,
    south: 11.20,
    east: 125.15,
    west: 124.95
  }

  return lat >= bounds.south && lat <= bounds.north && 
         lng >= bounds.west && lng <= bounds.east
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin, destination } = body

    // Validate input
    if (!origin || !destination || !Array.isArray(origin) || !Array.isArray(destination)) {
      return NextResponse.json(
        { error: 'Invalid coordinates provided' },
        { status: 400 }
      )
    }

    // Validate coordinate array length and types
    if (origin.length !== 2 || destination.length !== 2 || 
        typeof origin[0] !== 'number' || typeof origin[1] !== 'number' ||
        typeof destination[0] !== 'number' || typeof destination[1] !== 'number') {
      return NextResponse.json(
        { error: 'Coordinates must be [latitude, longitude] arrays with numeric values' },
        { status: 400 }
      )
    }

    // Type-cast to proper tuple types
    const originCoords: [number, number] = [origin[0], origin[1]]
    const destinationCoords: [number, number] = [destination[0], destination[1]]

    // Validate coordinates are within Basey bounds
    if (!validateBaseyCoordinates(originCoords) || !validateBaseyCoordinates(destinationCoords)) {
      return NextResponse.json(
        { error: 'Coordinates must be within Basey Municipality bounds' },
        { status: 400 }
      )
    }

    // Calculate direct distance using Haversine formula
    const distanceInMeters = calculateDistance(
      originCoords[0], originCoords[1],
      destinationCoords[0], destinationCoords[1]
    )

    const distanceInKm = distanceInMeters / 1000

    // Calculate fare
    const fareBreakdown = calculateFare(distanceInKm)

    // Estimate duration based on average speed (assuming 30 km/h average in municipality)
    const averageSpeedKmh = 30
    const durationInMinutes = Math.round((distanceInKm / averageSpeedKmh) * 60)

    const result = {
      success: true,
      route: {
        distance: {
          meters: Math.round(distanceInMeters),
          kilometers: parseFloat(distanceInKm.toFixed(2)),
          text: `${distanceInKm.toFixed(1)} km`
        },
        duration: {
          seconds: durationInMinutes * 60,
          text: durationInMinutes > 60 ? 
            `${Math.floor(durationInMinutes / 60)}h ${durationInMinutes % 60}m` : 
            `${durationInMinutes} mins`
        },
        fare: {
          distance: distanceInKm,
          fare: fareBreakdown.totalFare,
          breakdown: {
            baseFare: fareBreakdown.baseFare,
            additionalDistance: fareBreakdown.additionalDistance,
            additionalFare: fareBreakdown.additionalFare
          }
        },
        source: 'GPS Direct Distance',
        accuracy: 'Medium (straight-line distance)',
      },
    }

    return NextResponse.json(result)
      } catch (error) {    return NextResponse.json(
      { error: 'Internal server error while calculating GPS route' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'GPS Route API',
      usage: 'POST with { origin: [lat, lng], destination: [lat, lng] }',
      example: {
        origin: BASEY_CENTER, // Basey Center from GeoJSON data
        destination: [11.2768363, 125.0114879], // San Antonio
      },
      note: 'Calculates direct distance using Haversine formula. Does not account for actual roads.'
    },
    { status: 200 }
  )
}
