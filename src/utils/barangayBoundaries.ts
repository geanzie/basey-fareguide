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
    [key: string]: unknown;
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

export { barangayFeatures };