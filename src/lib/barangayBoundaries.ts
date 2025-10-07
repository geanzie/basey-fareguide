import barangayGeoJSON from '../data/Barangay.shp.geojson'

export interface BarangayFeature {
  type: 'Feature'
  properties: {
    Name: string
    BARANGAY: string
    BRGY_INDEX: number
    POB: boolean | null
    IN_POB: number | null
    OUT_POB: number | null
    color_id: number
  }
  geometry: {
    type: 'Polygon'
    coordinates: [number, number, number][][]
  }
}

export interface BarangayBoundaryService {
  findBarangayByCoordinates(lat: number, lng: number): BarangayFeature | null
  getBarangayCentroid(barangayName: string): [number, number] | null
  calculatePolygonArea(barangayName: string): number | null
  getNeighboringBarangays(barangayName: string): string[]
  validateRouteWithinBoundaries(route: [number, number][]): boolean
}

/**
 * Point-in-polygon algorithm using ray casting
 */
function pointInPolygon(point: [number, number], polygon: [number, number, number][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Calculate centroid of a polygon
 */
function calculateCentroid(coordinates: [number, number, number][]): [number, number] {
  let area = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x0, y0] = coordinates[i]
    const [x1, y1] = coordinates[i + 1]
    const a = x0 * y1 - x1 * y0
    area += a
    cx += (x0 + x1) * a
    cy += (y0 + y1) * a
  }

  area *= 0.5
  cx /= (6.0 * area)
  cy /= (6.0 * area)

  return [cy, cx] // Return as [lat, lng]
}

/**
 * Main service for barangay boundary operations
 */
export class BaseyBarangayBoundaryService implements BarangayBoundaryService {
  private features: BarangayFeature[]

  constructor() {
    this.features = barangayGeoJSON.features as BarangayFeature[]
  }

  /**
   * Find which barangay contains the given coordinates
   */
  findBarangayByCoordinates(lat: number, lng: number): BarangayFeature | null {
    const point: [number, number] = [lng, lat] // GeoJSON uses [lng, lat] format

    for (const feature of this.features) {
      if (feature.geometry.type === 'Polygon') {
        // Check each ring of the polygon
        for (const ring of feature.geometry.coordinates) {
          if (pointInPolygon(point, ring)) {
            return feature
          }
        }
      }
    }

    return null
  }

  /**
   * Get the centroid (center point) of a barangay
   */
  getBarangayCentroid(barangayName: string): [number, number] | null {
    const feature = this.features.find(f => 
      f.properties.Name?.toLowerCase() === barangayName.toLowerCase() ||
      f.properties.BARANGAY?.toLowerCase() === barangayName.toLowerCase()
    )

    if (!feature || feature.geometry.type !== 'Polygon') {
      return null
    }

    // Use the first ring (exterior) for centroid calculation
    const coordinates = feature.geometry.coordinates[0]
    return calculateCentroid(coordinates)
  }

  /**
   * Calculate approximate area of a barangay in square kilometers
   */
  calculatePolygonArea(barangayName: string): number | null {
    const feature = this.features.find(f => 
      f.properties.Name?.toLowerCase() === barangayName.toLowerCase() ||
      f.properties.BARANGAY?.toLowerCase() === barangayName.toLowerCase()
    )

    if (!feature || feature.geometry.type !== 'Polygon') {
      return null
    }

    // Simplified area calculation using shoelace formula
    const coordinates = feature.geometry.coordinates[0]
    let area = 0

    for (let i = 0; i < coordinates.length - 1; i++) {
      const [x1, y1] = coordinates[i]
      const [x2, y2] = coordinates[i + 1]
      area += (x1 * y2 - x2 * y1)
    }

    area = Math.abs(area) / 2
    
    // Convert from decimal degrees to approximate square kilometers
    // This is a rough approximation; for precise calculations, use projected coordinates
    const kmSquared = area * 111 * 111 * Math.cos(coordinates[0][1] * Math.PI / 180)
    
    return kmSquared
  }

  /**
   * Find neighboring barangays (simplified - checks for shared boundaries)
   */
  getNeighboringBarangays(barangayName: string): string[] {
    // This is a simplified implementation
    // For more accuracy, you would need to check for shared boundary segments
    const neighbors: string[] = []
    
    // Implementation would involve geometric analysis of polygon boundaries
    // For now, returning empty array - this can be enhanced with spatial analysis
    
    return neighbors
  }

  /**
   * Validate if a route stays within Basey municipality boundaries
   */
  validateRouteWithinBoundaries(route: [number, number][]): boolean {
    for (const point of route) {
      const barangay = this.findBarangayByCoordinates(point[0], point[1])
      if (!barangay) {
        return false // Point is outside any barangay
      }
    }
    return true
  }

  /**
   * Get all barangay names and their classification
   */
  getAllBarangays(): Array<{name: string, type: 'poblacion' | 'rural', index: number}> {
    return this.features.map(feature => ({
      name: feature.properties.Name || feature.properties.BARANGAY,
      type: feature.properties.POB ? 'poblacion' : 'rural',
      index: feature.properties.BRGY_INDEX
    }))
  }

  /**
   * Get accurate coordinates for barangay center (replaces hardcoded coordinates)
   */
  getAccurateBarangayCoordinates(): Record<string, [number, number]> {
    const coordinates: Record<string, [number, number]> = {}
    
    this.features.forEach(feature => {
      const name = feature.properties.Name || feature.properties.BARANGAY
      const centroid = this.getBarangayCentroid(name)
      if (name && centroid) {
        coordinates[name] = centroid
      }
    })
    
    return coordinates
  }
}

// Export singleton instance
export const barangayBoundaryService = new BaseyBarangayBoundaryService()