import { NextRequest, NextResponse } from 'next/server'
// Temporarily disabled to diagnose webpack issues
// import { googleMapsClient } from '@/lib/googleMapsService'
// import { TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js'

export async function POST(request: NextRequest) {
  // Temporarily disabled to diagnose webpack issues
  return NextResponse.json({
    error: 'Google Maps integration temporarily disabled for debugging',
    message: 'Please use the traditional fare calculator for now'
  }, { status: 503 });
  
  /* Original code temporarily disabled
export async function POST_DISABLED(request: NextRequest) {
  try {
    const { origin, destination } = await request.json()

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
        { status: 400 }
      )
    }

    if (!process.env.GOOGLE_MAPS_SERVER_API_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      )
    }

    // Use server-side API key if available, otherwise fall back to public key
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    // Call Google Maps Distance Matrix API
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        key: apiKey!,
        mode: TravelMode.driving,
        units: UnitSystem.metric,
        avoid: [], // You can add 'tolls', 'highways', 'ferries' if needed
        language: 'en',
        region: 'ph' // Philippines region
      }
    })

    const element = response.data.rows[0]?.elements[0]

    if (!element || element.status !== 'OK') {
      return NextResponse.json(
        { 
          error: 'Could not calculate route', 
          details: element?.status || 'Unknown error'
        },
        { status: 400 }
      )
    }

    // Also get detailed directions for polyline
    const directionsResponse = await googleMapsClient.directions({
      params: {
        origin: origin,
        destination: destination,
        key: apiKey!,
        mode: TravelMode.driving,
        units: UnitSystem.metric,
        region: 'ph'
      }
    })

    const route = directionsResponse.data.routes[0]
    const polyline = route?.overview_polyline?.points

    return NextResponse.json({
      distance: {
        text: element.distance.text,
        value: element.distance.value
      },
      duration: {
        text: element.duration.text,
        value: element.duration.value
      },
      polyline: polyline || null,
      status: 'OK'
    })

  } catch (error) {
    console.error('Google Maps API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to calculate route',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
*/

}
