import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split(' ')[1]
    const decoded = verify(token, process.env.JWT_SECRET || 'fallback_secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = parseInt(searchParams.get('period') || '7')
    
    // Verify authentication
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only enforcers can access this endpoint
    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - period)

    // Get incidents within the period
    const incidents = await prisma.incident.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        reportedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Process hotspot data
    const hotspots = analyzeHotspots(incidents, period)

    return NextResponse.json({
      success: true,
      hotspots,
      summary: {
        totalIncidents: incidents.length,
        period,
        analyzedFrom: startDate.toISOString(),
        analyzedTo: endDate.toISOString()
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    })
      } catch (error) {    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface HotspotData {
  id: string
  area: string
  coordinates: {
    lat: number
    lng: number
  }
  incidentCount: number
  commonViolations: {
    type: string
    count: number
    percentage: number
  }[]
  timePatterns: {
    hour: number
    count: number
  }[]
  severityScore: number
  trend: 'increasing' | 'stable' | 'decreasing'
  recommendedAction: string
}

function analyzeHotspots(incidents: any[], period: number): HotspotData[] {
  // Group incidents by geographic areas (simplified clustering)
  const areaGroups: { [key: string]: any[] } = {}
  
  incidents.forEach(incident => {
    if (incident.latitude && incident.longitude) {
      // Simple area clustering based on coordinate proximity
      const areaKey = getAreaKey(incident.latitude, incident.longitude)
      if (!areaGroups[areaKey]) {
        areaGroups[areaKey] = []
      }
      areaGroups[areaKey].push(incident)
    }
  })

  // Convert to hotspot data
  const hotspots: HotspotData[] = []
  
  Object.entries(areaGroups).forEach(([areaKey, areaIncidents]) => {
    if (areaIncidents.length >= 3) { // Minimum threshold for hotspot
      const hotspot = analyzeArea(areaKey, areaIncidents, period)
      hotspots.push(hotspot)
    }
  })

  // Sort by severity score (descending)
  return hotspots.sort((a, b) => b.severityScore - a.severityScore)
}

function getAreaKey(lat: number, lng: number): string {
  // Simple coordinate clustering - group by 0.002 degree grid
  const gridLat = Math.floor(lat * 500) / 500
  const gridLng = Math.floor(lng * 500) / 500
  return `${gridLat}_${gridLng}`
}

function analyzeArea(areaKey: string, incidents: any[], period: number): HotspotData {
  // Calculate area center
  const avgLat = incidents.reduce((sum, inc) => sum + inc.latitude, 0) / incidents.length
  const avgLng = incidents.reduce((sum, inc) => sum + inc.longitude, 0) / incidents.length
  
  // Analyze violation types
  const violationCounts: { [key: string]: number } = {}
  incidents.forEach(incident => {
    const type = incident.violationType || 'OTHER'
    violationCounts[type] = (violationCounts[type] || 0) + 1
  })

  const commonViolations = Object.entries(violationCounts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / incidents.length) * 100 * 10) / 10
    }))
    .sort((a, b) => b.count - a.count)

  // Analyze time patterns
  const hourCounts: { [key: number]: number } = {}
  incidents.forEach(incident => {
    const hour = new Date(incident.createdAt).getHours()
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  })

  const timePatterns = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count
    }))
    .sort((a, b) => a.hour - b.hour)

  // Calculate severity score
  const baseScore = Math.min(incidents.length / period * 2, 8) // Base on incident frequency
  const violationSeverity = getViolationSeverityMultiplier(commonViolations[0]?.type)
  const severityScore = Math.min(baseScore * violationSeverity, 10)

  // Determine trend (simplified)
  const trend = determineTrend(incidents, period)

  // Generate area name
  const areaName = generateAreaName(avgLat, avgLng)

  // Generate recommendation
  const recommendedAction = generateRecommendation(commonViolations, timePatterns, severityScore)

  return {
    id: areaKey,
    area: areaName,
    coordinates: {
      lat: avgLat,
      lng: avgLng
    },
    incidentCount: incidents.length,
    commonViolations,
    timePatterns,
    severityScore: Math.round(severityScore * 10) / 10,
    trend,
    recommendedAction
  }
}

function getViolationSeverityMultiplier(violationType?: string): number {
  const severityMap: { [key: string]: number } = {
    'RECKLESS_DRIVING': 1.5,
    'FARE_OVERCHARGE': 1.2,
    'VEHICLE_VIOLATION': 1.3,
    'ROUTE_VIOLATION': 1.1,
    'FARE_UNDERCHARGE': 1.0,
    'OTHER': 1.0
  }
  return severityMap[violationType || 'OTHER'] || 1.0
}

function determineTrend(incidents: any[], period: number): 'increasing' | 'stable' | 'decreasing' {
  if (incidents.length < 6) return 'stable' // Not enough data
  
  const midpoint = new Date()
  midpoint.setDate(midpoint.getDate() - period / 2)
  
  const recentIncidents = incidents.filter(inc => new Date(inc.createdAt) >= midpoint)
  const olderIncidents = incidents.filter(inc => new Date(inc.createdAt) < midpoint)
  
  const recentRate = recentIncidents.length / (period / 2)
  const olderRate = olderIncidents.length / (period / 2)
  
  if (recentRate > olderRate * 1.2) return 'increasing'
  if (recentRate < olderRate * 0.8) return 'decreasing'
  return 'stable'
}

function generateAreaName(lat: number, lng: number): string {
  // Simplified area naming based on Basey coordinates
  const areas = [
    { name: 'Poblacion Market Area', lat: 11.2758, lng: 124.9628, radius: 0.002 },
    { name: 'Basey Elementary School Zone', lat: 11.2760, lng: 124.9625, radius: 0.002 },
    { name: 'San Antonio Terminal', lat: 11.2755, lng: 124.9630, radius: 0.002 },
    { name: 'Guintigui-an Route', lat: 11.2750, lng: 124.9640, radius: 0.003 },
    { name: 'Basey Port Area', lat: 11.2765, lng: 124.9620, radius: 0.002 },
    { name: 'National Highway Junction', lat: 11.2745, lng: 124.9635, radius: 0.002 }
  ]

  for (const area of areas) {
    const distance = Math.sqrt(
      Math.pow(lat - area.lat, 2) + Math.pow(lng - area.lng, 2)
    )
    if (distance <= area.radius) {
      return area.name
    }
  }

  // Default to general area description
  return `Area ${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function generateRecommendation(
  violations: { type: string; count: number }[],
  timePatterns: { hour: number; count: number }[],
  severityScore: number
): string {
  const topViolation = violations[0]?.type
  const peakHours = timePatterns
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(t => t.hour)

  let recommendation = ''

  if (severityScore >= 8) {
    recommendation += 'High priority area requiring immediate attention. '
  } else if (severityScore >= 6) {
    recommendation += 'Moderate priority area needing regular monitoring. '
  } else {
    recommendation += 'Low priority area for routine patrols. '
  }

  if (topViolation) {
    switch (topViolation) {
      case 'RECKLESS_DRIVING':
        recommendation += 'Focus on traffic safety enforcement and speed monitoring. '
        break
      case 'FARE_OVERCHARGE':
        recommendation += 'Increase fare compliance checks and passenger education. '
        break
      case 'VEHICLE_VIOLATION':
        recommendation += 'Conduct regular vehicle inspections and roadworthiness checks. '
        break
      case 'ROUTE_VIOLATION':
        recommendation += 'Monitor route compliance and unauthorized route operations. '
        break
    }
  }

  if (peakHours.length > 0) {
    const timeRanges = peakHours.map(h => `${h}:00-${h + 1}:00`).join(', ')
    recommendation += `Concentrate patrols during peak incident hours: ${timeRanges}.`
  }

  return recommendation || 'Regular monitoring and standard patrol procedures recommended.'
}
