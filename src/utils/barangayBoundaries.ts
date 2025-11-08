import barangayData from '../data/Barangay.shp.json';

export interface BarangayFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    Name?: string | null;
    BARANGAY: string;
    BRGY_INDEX: number;
    POB?: boolean | null;
    IN_POB?: number | null;
    OUT_POB?: number | null;
    [key: string]: any;
  };
}

export interface BarangayInfo {
  name: string;
  code: string;
  isPoblacion: boolean;
  center: [number, number];
  bounds: [[number, number], [number, number]];
}

// Load and parse barangay data, filtering out invalid features
const barangayFeatures = (barangayData.features as BarangayFeature[])
  .filter(feature => feature.properties && feature.properties.BARANGAY);

/**
 * Point-in-polygon algorithm using ray casting
 */
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (const ring of polygon) {
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
        inside = !inside;
      }
      j = i;
    }
  }
  return inside;
}

/**
 * Calculate polygon centroid using simple arithmetic mean
 * Note: Using simple mean instead of area-weighted centroid because
 * area-weighted centroids can fall in inaccessible areas (water, forest, etc.)
 * causing Google Maps routing to fail with ZERO_RESULTS
 */
function calculateCentroid(coordinates: number[][][]): [number, number] {
  const ring = coordinates[0]; // Use outer ring
  let sumX = 0;
  let sumY = 0;
  
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    sumX += x;
    sumY += y;
  }
  
  const centroidX = sumX / ring.length;
  const centroidY = sumY / ring.length;

  return [centroidX, centroidY];
}

/**
 * Calculate bounding box for polygon
 */
function calculateBounds(coordinates: number[][][]): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  coordinates[0].forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * Find which barangay a coordinate falls within
 */
export function getBarangayFromCoordinate(lng: number, lat: number): BarangayInfo | null {
  const point: [number, number] = [lng, lat];

  for (const feature of barangayFeatures) {
    // Skip features with missing essential data
    if (!feature.properties || 
        !feature.properties.BARANGAY || 
        typeof feature.properties.BARANGAY !== 'string' ||
        !feature.geometry ||
        !feature.geometry.coordinates) {
      continue;
    }

    if (pointInPolygon(point, feature.geometry.coordinates)) {
      const center = calculateCentroid(feature.geometry.coordinates);
      const bounds = calculateBounds(feature.geometry.coordinates);
      
      return {
        name: feature.properties.BARANGAY,
        code: `BRGY_${feature.properties.BRGY_INDEX || feature.properties.BARANGAY}`,
        isPoblacion: feature.properties.POB === true || feature.properties.IN_POB !== null,
        center,
        bounds
      };
    }
  }
  return null;
}

/**
 * Get all barangay information
 */
export function getAllBarangays(): BarangayInfo[] {
  return barangayFeatures
    .filter(feature => {
      // Filter out features with missing essential properties
      return feature.properties && 
             feature.properties.BARANGAY && 
             typeof feature.properties.BARANGAY === 'string' &&
             feature.geometry &&
             feature.geometry.coordinates;
    })
    .map(feature => {
      const center = calculateCentroid(feature.geometry.coordinates);
      const bounds = calculateBounds(feature.geometry.coordinates);
      
      return {
        name: feature.properties.BARANGAY,
        code: `BRGY_${feature.properties.BRGY_INDEX || feature.properties.BARANGAY}`,
        isPoblacion: feature.properties.POB === true || feature.properties.IN_POB !== null,
        center,
        bounds
      };
    });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // Earth's radius in kilometers
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a route crosses barangay boundaries
 */
export function analyzeRouteCrossings(route: [number, number][]): {
  barangaysCrossed: BarangayInfo[];
  boundariesCrossed: number;
  isIntraMunicipal: boolean;
} {
  const barangaysCrossed = new Set<string>();
  let boundariesCrossed = 0;
  let lastBarangay: string | null = null;

  route.forEach(([lng, lat]) => {
    const barangay = getBarangayFromCoordinate(lng, lat);
    if (barangay) {
      if (lastBarangay && lastBarangay !== barangay.name) {
        boundariesCrossed++;
      }
      barangaysCrossed.add(barangay.name);
      lastBarangay = barangay.name;
    }
  });

  const crossedBarangaysList = Array.from(barangaysCrossed)
    .map(name => getAllBarangays().find(b => b.name === name)!)
    .filter(Boolean);

  return {
    barangaysCrossed: crossedBarangaysList,
    boundariesCrossed,
    isIntraMunicipal: true // All barangays are within Basey municipality
  };
}

/**
 * Get barangay-based fare multiplier
 */
export function getBarangayFareMultiplier(barangayInfo: BarangayInfo): number {
  // Poblacion areas might have different rates
  if (barangayInfo.isPoblacion) {
    return 1.0; // Base rate for poblacion
  }
  
  // Rural areas might have distance-based multipliers
  return 1.1; // Slightly higher for rural areas
}

/**
 * Enhanced fare calculation with barangay boundaries
 */
export function calculateEnhancedFare({
  origin,
  destination,
  baseFare = 15,
  perKmRate = 8,
  boundaryFee = 5
}: {
  origin: [number, number];
  destination: [number, number];
  baseFare?: number;
  perKmRate?: number;
  boundaryFee?: number;
}) {
  const originBarangay = getBarangayFromCoordinate(origin[0], origin[1]);
  const destinationBarangay = getBarangayFromCoordinate(destination[0], destination[1]);
  
  const distance = calculateDistance(origin, destination);
  let fare = baseFare + (distance * perKmRate);
  
  // Apply barangay-specific multipliers
  if (originBarangay) {
    fare *= getBarangayFareMultiplier(originBarangay);
  }
  
  // Add boundary crossing fee if crossing barangays
  if (originBarangay && destinationBarangay && 
      originBarangay.name !== destinationBarangay.name) {
    fare += boundaryFee;
  }
  
  return {
    totalFare: Math.round(fare * 100) / 100,
    distance: Math.round(distance * 100) / 100,
    originBarangay: originBarangay?.name || 'Unknown',
    destinationBarangay: destinationBarangay?.name || 'Unknown',
    crossesBoundary: originBarangay?.name !== destinationBarangay?.name
  };
}

/**
 * Debug function to check data integrity
 */
export function debugBarangayData(): {
  totalFeatures: number;
  validFeatures: number;
  invalidFeatures: Array<{ index: number; issue: string }>;
  sampleData: Array<{ index: number; BARANGAY: any; Name: any; BRGY_INDEX: any; POB: any }>;
} {
  const issues: Array<{ index: number; issue: string }> = [];
  let validCount = 0;

  barangayFeatures.forEach((feature, index) => {
    if (!feature.properties) {
      issues.push({ index, issue: 'Missing properties object' });
      return;
    }
    if (!feature.properties.BARANGAY || typeof feature.properties.BARANGAY !== 'string') {
      issues.push({ index, issue: `Invalid or missing BARANGAY: ${feature.properties.BARANGAY}` });
      return;
    }
    if (!feature.geometry || !feature.geometry.coordinates) {
      issues.push({ index, issue: 'Missing geometry or coordinates' });
      return;
    }
    validCount++;
  });

  return {
    totalFeatures: barangayFeatures.length,
    validFeatures: validCount,
    invalidFeatures: issues,
    sampleData: barangayFeatures.slice(0, 5).map((f, i) => ({
      index: i,
      BARANGAY: f.properties?.BARANGAY,
      Name: f.properties?.Name,
      BRGY_INDEX: f.properties?.BRGY_INDEX,
      POB: f.properties?.POB
    }))
  };
}

export { barangayFeatures };