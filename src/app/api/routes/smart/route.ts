import { NextRequest, NextResponse } from 'next/server'
import { BASEY_CENTER, BASEY_LANDMARKS, EXTERNAL_LANDMARKS } from '@/utils/baseyCenter'

// Barangay coordinates mapping
const barangayCoordinates: Record<string, [number, number]> = {
  // Official Barangays of Basey Municipality (51 Barangays)
  'Amandayehan': [11.2755464, 124.9989947],
  'Anglit': [11.2976225, 125.1096464],
  'Bacubac': [11.2822154, 125.0484524],
  'Baloog': [11.382020463636366, 125.06847321818182],
  'Basiao': [11.260895816210494, 125.16131895224565],
  'Buenavista': [11.2612303, 125.1610249],
  'Burgos': [11.31878713228347, 125.14862673543306],
  'Cambayan': [11.284089, 124.9963614],
  'Can-abay': [11.2964442, 125.0171976],
  'Cancaiyas': [11.3551012625, 125.08608441249999],
  'Canmanila': [11.2866303, 125.0575179],
  'Catadman': [11.2725188, 125.1529991],
  'Cogon': [11.333611, 125.097222],
  'Dolongan': [11.3358835, 125.0288258],
  'Guintigui-an': [11.1168402, 124.5282884],
  'Guirang': [11.343588777884616, 125.14981559903842],
  'Balante': [11.3388426, 125.0437445],
  'Iba': [11.2943547, 125.0929189],
  'Inuntan': [11.349131557068063, 125.13479928743449],
  'Loog': [11.3109945, 125.1576871],
  'Mabini': [11.411063884259258, 125.14977773796299],
  'Magallanes': [11.2959849, 125.1180654],
  'Manlilinab': [11.443771109230763, 125.11989884000002],
  'Del Pilar': [11.3181604, 125.1455537],
  'May-it': [11.3080943, 125.0152557],
  'Mongabong': [11.3243908, 125.0234979],
  'New San Agustin': [11.3156829, 125.0970982],
  'Nouvelas Occidental': [11.2878942, 125.1279255],
  'Old San Agustin': [11.3233043, 125.1059211],
  'Panugmonon': [11.3051139, 125.1469289],
  'Pelit': [11.3030507, 125.1564277],
  
  // Poblacion Barangays (7 Urban Centers)
  'Baybay (Poblacion)': [11.28167, 125.06833],
  'Buscada (Poblacion)': [11.2814091, 125.0667279],
  'Lawa-an (Poblacion)': [11.2817, 125.0683],
  'Loyo (Poblacion)': [11.280393, 125.067366],
  'Mercado (Poblacion)': [11.2802359, 125.0701055],
  'Palaypay (Poblacion)': [11.2845559, 125.0687231],
  'Sulod (Poblacion)': [11.2818956, 125.0688281],
  
  // Remaining Barangays
  'Roxas': [11.3067742, 125.0511018],
  'Salvacion': [11.2671612, 125.0751775],
  'San Antonio': [11.2768363, 125.0114879],
  'San Fernando': [11.2788975, 125.1467683],
  'Sawa': [11.305259, 125.0801691],
  'Serum': [11.297623, 125.1297929],
  'Sugca': [11.2919124, 125.1038343],
  'Sugponon': [11.2881403, 125.1053266],
  'Tinaogan': [11.2893217, 124.9771129],
  'Tingib': [11.2785632, 125.032787],
  'Villa Aurora': [11.3389437, 125.0646847],
  'Binongtu-an': [11.2909236, 125.1192263],
  'Bulao': [11.3381704, 125.1021105],
  
  // Key Landmarks and Places of Interest in Basey Municipality
  // Using GeoJSON-based coordinates following the rule: "follow whatever the .geojson file has because this is the most realistic coordinates data"
  'José Rizal Monument (Basey Center - KM 0)': BASEY_LANDMARKS['José Rizal Monument (Basey Center - KM 0)'],
  'Sohoton Natural Bridge National Park': EXTERNAL_LANDMARKS['Sohoton Natural Bridge National Park'],
  'Sohoton Caves': EXTERNAL_LANDMARKS['Sohoton Caves'],
  'Panhulugan Cliff': EXTERNAL_LANDMARKS['Panhulugan Cliff'],
  'Basey Church (St. Michael the Archangel)': BASEY_LANDMARKS['Basey Church (St. Michael the Archangel)'],
  'Basey Municipal Hall': BASEY_LANDMARKS['Basey Municipal Hall'],
  'Basey Public Market': BASEY_LANDMARKS['Basey Public Market'],
  'Basey I Central School': BASEY_LANDMARKS['Basey I Central School'],
  'Basey National High School': BASEY_LANDMARKS['Basey National High School'],
  'Basey Port/Wharf': BASEY_LANDMARKS['Basey Port/Wharf'],
  'Rural Health Unit Basey': BASEY_LANDMARKS['Rural Health Unit Basey']
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin, destination, preferredMethod = 'auto' } = body

    // Validate input - can be either location names or coordinates
    let originCoords: [number, number]
    let destinationCoords: [number, number]

    // Check if inputs are location names or coordinates
    if (typeof origin === 'string' && typeof destination === 'string') {
      // Location names - look up coordinates
      const originCoord = barangayCoordinates[origin]
      const destinationCoord = barangayCoordinates[destination]

      if (!originCoord || !destinationCoord) {
        return NextResponse.json(
          { error: 'Invalid location names provided. Please select from the available barangays.' },
          { status: 400 }
        )
      }

      originCoords = originCoord
      destinationCoords = destinationCoord
    } else if (Array.isArray(origin) && Array.isArray(destination)) {
      // Coordinates provided
      if (origin.length !== 2 || destination.length !== 2 || 
          typeof origin[0] !== 'number' || typeof origin[1] !== 'number' ||
          typeof destination[0] !== 'number' || typeof destination[1] !== 'number') {
        return NextResponse.json(
          { error: 'Coordinates must be [latitude, longitude] arrays with numeric values' },
          { status: 400 }
        )
      }
      
      originCoords = [origin[0], origin[1]]
      destinationCoords = [destination[0], destination[1]]
    } else {
      return NextResponse.json(
        { error: 'Invalid input format. Provide either location names or coordinates.' },
        { status: 400 }
      )
    }

    // First, try Google Maps if preferred method allows it
    if (preferredMethod === 'google-maps' || preferredMethod === 'auto') {
      try {
        const googleMapsResponse = await fetch(`${request.nextUrl.origin}/api/routes/google-maps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ origin: originCoords, destination: destinationCoords }),
        })

        if (googleMapsResponse.ok) {
          const googleMapsData = await googleMapsResponse.json()
          return NextResponse.json({
            ...googleMapsData,
            method: 'google-maps',
            fallbackUsed: false
          })
        } else {
          // Google Maps failed, fall back to GPS if auto mode
          if (preferredMethod === 'auto') {          } else {
            // If specifically requested Google Maps and it failed, return the error
            const errorData = await googleMapsResponse.json()
            return NextResponse.json(errorData, { status: googleMapsResponse.status })
          }
        }
      } catch (error) {
      // Continue to GPS fallback
      }
    }

    // Use GPS calculation (either as fallback or if specifically requested)
    const gpsResponse = await fetch(`${request.nextUrl.origin}/api/routes/gps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin: originCoords, destination: destinationCoords }),
    })

    if (gpsResponse.ok) {
      const gpsData = await gpsResponse.json()
      return NextResponse.json({
        ...gpsData,
        method: 'gps',
        fallbackUsed: preferredMethod !== 'gps'
      })
    } else {
      const errorData = await gpsResponse.json()
      return NextResponse.json(
        { error: `Both Google Maps and GPS calculations failed. ${errorData.error}` },
        { status: 500 }
      )
    }

  } catch (error) {    return NextResponse.json(
      { error: 'Internal server error while calculating route' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Smart Route Calculator API',
      description: 'Intelligent routing that tries Google Maps first and falls back to GPS calculation',
      usage: 'POST with { origin: "Barangay Name" | [lat, lng], destination: "Barangay Name" | [lat, lng], preferredMethod?: "auto" | "google-maps" | "gps" }',
      methods: {
        'google-maps': 'Uses Google Maps API for precise road routing',
        'gps': 'Uses GPS direct distance calculation',
        'auto': 'Tries Google Maps first, falls back to GPS on failure (default)'
      },
      examples: {
        'with_names': {
          origin: 'José Rizal Monument (Basey Center - KM 0)',
          destination: 'San Antonio',
          preferredMethod: 'auto'
        },
        'with_coordinates': {
          origin: BASEY_CENTER,
          destination: [11.2768363, 125.0114879],
          preferredMethod: 'auto'
        }
      },
      available_locations: Object.keys(barangayCoordinates).slice(0, 10).concat(['...and more'])
    },
    { status: 200 }
  )
}
