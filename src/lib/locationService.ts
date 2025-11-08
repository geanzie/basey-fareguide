/**
 * Location Service
 * 
 * This service provides access to all verified locations in Basey, Samar
 * from the comprehensive basey-locations.json file.
 * 
 * Location types:
 * - Barangays (51 total)
 * - Landmarks (96 total - schools, churches, bridges, government buildings, etc.)
 * - Sitios (11 total)
 */

import baseyLocationsData from '@/data/basey-locations.json'

export interface LocationCoordinates {
  lat: number
  lng: number
}

export interface Location {
  name: string
  coordinates: LocationCoordinates
  source: string
  address: string
  verified: boolean
  type?: string // For landmarks and sitios
  category: 'barangay' | 'landmark' | 'sitio'
}

export interface LocationMetadata {
  municipality: string
  province: string
  total_locations: number
  last_updated: string
  sources: string[]
}

class LocationService {
  private locations: Location[] = []
  private metadata: LocationMetadata | null = null
  private initialized = false

  /**
   * Initialize the location service by loading all locations from JSON
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.metadata = baseyLocationsData.metadata as LocationMetadata
      this.locations = []

      // Load barangays
      if (baseyLocationsData.locations.barangay) {
        baseyLocationsData.locations.barangay.forEach((location: any) => {
          this.locations.push({
            ...location,
            category: 'barangay' as const
          })
        })
      }

      // Load landmarks
      if (baseyLocationsData.locations.landmark) {
        baseyLocationsData.locations.landmark.forEach((location: any) => {
          this.locations.push({
            ...location,
            category: 'landmark' as const
          })
        })
      }

      // Load sitios
      if (baseyLocationsData.locations.sitio) {
        baseyLocationsData.locations.sitio.forEach((location: any) => {
          this.locations.push({
            ...location,
            category: 'sitio' as const
          })
        })
      }

      this.initialized = true
      console.log(`✅ Location Service: Loaded ${this.locations.length} locations from ${this.metadata?.last_updated}`)
    } catch (error) {
      console.error('❌ Failed to initialize location service:', error)
      throw error
    }
  }

  /**
   * Get all locations
   */
  getAllLocations(): Location[] {
    if (!this.initialized) {
      throw new Error('Location service not initialized. Call initialize() first.')
    }
    return this.locations
  }

  /**
   * Get locations by category
   */
  getLocationsByCategory(category: 'barangay' | 'landmark' | 'sitio'): Location[] {
    return this.locations.filter(loc => loc.category === category)
  }

  /**
   * Get all barangays
   */
  getBarangays(): Location[] {
    return this.getLocationsByCategory('barangay')
  }

  /**
   * Get all landmarks
   */
  getLandmarks(): Location[] {
    return this.getLocationsByCategory('landmark')
  }

  /**
   * Get all sitios
   */
  getSitios(): Location[] {
    return this.getLocationsByCategory('sitio')
  }

  /**
   * Find a location by name (case-insensitive)
   */
  findLocationByName(name: string): Location | undefined {
    const searchName = name.toLowerCase().trim()
    return this.locations.find(loc => 
      loc.name.toLowerCase().trim() === searchName
    )
  }

  /**
   * Search locations by partial name match
   */
  searchLocations(query: string): Location[] {
    const searchQuery = query.toLowerCase().trim()
    if (!searchQuery) return []
    
    return this.locations.filter(loc =>
      loc.name.toLowerCase().includes(searchQuery) ||
      loc.address.toLowerCase().includes(searchQuery)
    )
  }

  /**
   * Get location coordinates by name
   */
  getCoordinates(name: string): LocationCoordinates | null {
    const location = this.findLocationByName(name)
    return location ? location.coordinates : null
  }

  /**
   * Get metadata about the location dataset
   */
  getMetadata(): LocationMetadata | null {
    return this.metadata
  }

  /**
   * Get locations grouped by category for UI display
   */
  getGroupedLocations(): {
    barangays: Location[]
    landmarks: Location[]
    sitios: Location[]
  } {
    return {
      barangays: this.getBarangays().sort((a, b) => a.name.localeCompare(b.name)),
      landmarks: this.getLandmarks().sort((a, b) => a.name.localeCompare(b.name)),
      sitios: this.getSitios().sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get statistics about loaded locations
   */
  getStats() {
    return {
      total: this.locations.length,
      barangays: this.getBarangays().length,
      landmarks: this.getLandmarks().length,
      sitios: this.getSitios().length,
      verified: this.locations.filter(loc => loc.verified).length,
      sources: this.metadata?.sources || []
    }
  }
}

// Export singleton instance
export const locationService = new LocationService()
