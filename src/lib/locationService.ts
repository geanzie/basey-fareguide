/**
 * Location Service
 * 
 * This service provides planner-visible locations from the canonical
 * database-backed /api/locations endpoint.
 */
import type {
  LocationCoordinatesDto,
  PlannerLocationDto as Location,
  PlannerLocationsMetadataDto as LocationMetadata,
  PlannerLocationsResponseDto,
} from '@/lib/contracts'

export type { Location, LocationCoordinatesDto as LocationCoordinates, LocationMetadata }

class LocationService {
  private locations: Location[] = []
  private metadata: LocationMetadata | null = null
  private initialized = false

  /**
   * Initialize the location service from the canonical database-backed API.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const response = await fetch('/api/locations')
      const data: PlannerLocationsResponseDto = await response.json()

      if (!response.ok || !data.success || !Array.isArray(data.locations)) {
        throw new Error(data.error || 'Failed to load planner locations')
      }

      this.locations = data.locations
      this.metadata = {
        municipality: data.metadata?.municipality || 'Basey',
        province: data.metadata?.province || 'Samar',
        total_locations: data.metadata?.total_locations || data.locations.length,
        last_updated: data.metadata?.last_updated || new Date(0).toISOString(),
        sources: Array.isArray(data.metadata?.sources) ? data.metadata.sources : ['database']
      }
      this.initialized = true
    } catch (error) {
      console.error('Error initializing location service:', error)
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
  getCoordinates(name: string): LocationCoordinatesDto | null {
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
