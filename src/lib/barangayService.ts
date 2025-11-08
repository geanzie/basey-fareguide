import { 
  BarangayInfo, 
  getAllBarangays, 
  getBarangayFromCoordinate,
  calculateDistance,
  analyzeRouteCrossings,
  calculateEnhancedFare,
  barangayFeatures,
  debugBarangayData
} from '../utils/barangayBoundaries';

class BarangayService {
  private barangayCache: Map<string, BarangayInfo> = new Map();
  private coordinateCache: Map<string, BarangayInfo | null> = new Map();
  private allBarangays: BarangayInfo[] | null = null;

  /**
   * Initialize service and cache barangay data
   */
  async initialize(): Promise<void> {
    if (this.allBarangays) return;
    
    try {
      // Debug the raw data first
      const debugInfo = debugBarangayData();      if (debugInfo.invalidFeatures.length > 0) {      }
      
      this.allBarangays = getAllBarangays();      // Cache barangays by name and code (with null checks)
      this.allBarangays.forEach((barangay, index) => {
        if (!barangay) {          return;
        }
        
        if (barangay.name && typeof barangay.name === 'string') {
          this.barangayCache.set(barangay.name.toLowerCase(), barangay);
        } else {        }
        
        if (barangay.code && typeof barangay.code === 'string') {
          this.barangayCache.set(barangay.code, barangay);
        } else {        }
      });    } catch (error) {      throw error;
    }
  }

  /**
   * Get barangay by name or code
   */
  getBarangay(identifier: string): BarangayInfo | null {
    return this.barangayCache.get(identifier.toLowerCase()) || null;
  }

  /**
   * Get all barangays with optional filtering
   */
  getBarangays(filter?: {
    poblacionOnly?: boolean;
    searchTerm?: string;
  }): BarangayInfo[] {
    if (!this.allBarangays) {
      this.initialize();
      return [];
    }

    let result = this.allBarangays;

    if (filter?.poblacionOnly) {
      result = result.filter(b => b.isPoblacion);
    }

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term)
      );
    }

    return result;
  }

  /**
   * Find barangay from coordinates with caching
   */
  findBarangayFromCoordinate(lng: number, lat: number): BarangayInfo | null {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    
    if (this.coordinateCache.has(key)) {
      return this.coordinateCache.get(key)!;
    }

    const barangay = getBarangayFromCoordinate(lng, lat);
    this.coordinateCache.set(key, barangay);
    
    return barangay;
  }

  /**
   * Calculate optimized route between barangays
   */
  calculateOptimizedRoute({
    fromCoord,
    toCoord,
    fareConfig = {}
  }: {
    fromCoord: [number, number];
    toCoord: [number, number];
    fareConfig?: {
      baseFare?: number;
      perKmRate?: number;
      boundaryFee?: number;
    };
  }) {
    const fareResult = calculateEnhancedFare({
      origin: fromCoord,
      destination: toCoord,
      ...fareConfig
    });

    const originBarangay = this.findBarangayFromCoordinate(fromCoord[0], fromCoord[1]);
    const destinationBarangay = this.findBarangayFromCoordinate(toCoord[0], toCoord[1]);

    return {
      ...fareResult,
      originBarangayInfo: originBarangay,
      destinationBarangayInfo: destinationBarangay,
      recommendations: this.generateRouteRecommendations({
        origin: originBarangay,
        destination: destinationBarangay,
        distance: fareResult.distance
      })
    };
  }

  /**
   * Generate route recommendations based on barangay analysis
   */
  private generateRouteRecommendations({
    origin,
    destination,
    distance
  }: {
    origin: BarangayInfo | null;
    destination: BarangayInfo | null;
    distance: number;
  }): string[] {
    const recommendations: string[] = [];

    if (!origin || !destination) {
      recommendations.push('⚠️ Route includes areas outside mapped barangay boundaries');
      return recommendations;
    }

    if (origin.name === destination.name) {
      recommendations.push('🏠 Intra-barangay trip - local rates may apply');
    }

    if (origin.isPoblacion || destination.isPoblacion) {
      recommendations.push('🏛️ Route includes poblacion area - standard urban rates');
    }

    if (distance > 10) {
      recommendations.push('🚗 Long distance trip - consider alternative transportation');
    }

    if (distance < 2) {
      recommendations.push('🚶 Short trip - walking might be feasible');
    }

    return recommendations;
  }

  /**
   * Analyze hotspots and popular routes
   */
  analyzeGeographicHotspots(incidents: Array<{
    latitude: number;
    longitude: number;
    type?: string;
  }>): {
    barangayHotspots: Array<{
      barangay: BarangayInfo;
      incidentCount: number;
      incidentTypes: Record<string, number>;
    }>;
    totalMappedIncidents: number;
  } {
    const barangayIncidents = new Map<string, {
      barangay: BarangayInfo;
      count: number;
      types: Record<string, number>;
    }>();

    let mappedCount = 0;

    incidents.forEach(incident => {
      const barangay = this.findBarangayFromCoordinate(incident.longitude, incident.latitude);
      
      if (barangay) {
        mappedCount++;
        const key = barangay.name;
        
        if (!barangayIncidents.has(key)) {
          barangayIncidents.set(key, {
            barangay,
            count: 0,
            types: {}
          });
        }

        const entry = barangayIncidents.get(key)!;
        entry.count++;
        
        if (incident.type) {
          entry.types[incident.type] = (entry.types[incident.type] || 0) + 1;
        }
      }
    });

    return {
      barangayHotspots: Array.from(barangayIncidents.values())
        .map(entry => ({
          barangay: entry.barangay,
          incidentCount: entry.count,
          incidentTypes: entry.types
        }))
        .sort((a, b) => b.incidentCount - a.incidentCount),
      totalMappedIncidents: mappedCount
    };
  }

  /**
   * Get neighboring barangays (simplified - based on distance)
   */
  getNeighboringBarangays(barangay: BarangayInfo, maxDistance = 5): BarangayInfo[] {
    if (!this.allBarangays) return [];

    return this.allBarangays
      .filter(b => b.name !== barangay.name)
      .map(b => ({
        ...b,
        distance: calculateDistance(barangay.center, b.center)
      }))
      .filter(b => b.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .map(b => ({ ...b, distance: undefined }) as BarangayInfo);
  }

  /**
   * Export barangay data for mapping libraries
   */
  getGeoJSONData() {
    return {
      type: 'FeatureCollection',
      features: barangayFeatures
    };
  }

  /**
   * Clear caches (useful for testing or memory management)
   */
  clearCache(): void {
    this.coordinateCache.clear();
  }
}

// Singleton instance
export const barangayService = new BarangayService();

// Initialize on import
barangayService.initialize().catch(() => {});

export default barangayService;