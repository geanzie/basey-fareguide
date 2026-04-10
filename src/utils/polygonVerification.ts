// Polygon verification utility for checking if coordinates are within their actual barangay boundaries
// Uses GeoJSON data and point-in-polygon algorithms

import barangayData from '../data/Barangay.shp.json';

export interface PolygonFeature {
  type: "Feature";
  properties: {
    Name: string;
    BARANGAY: string;
    BRGY_INDEX: number;
    OUT_POB: number | null;
    IN_POB: number | null;
    POB: boolean | null;
    NO_: number;
    color_id: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

/**
 * Point-in-polygon algorithm using ray casting
 * @param point [longitude, latitude] - Note: GeoJSON uses [lng, lat] format
 * @param polygon Array of [longitude, latitude] points defining the polygon
 * @returns boolean indicating if point is inside polygon
 */
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Find which barangay polygon contains the given coordinates
 * @param coords [latitude, longitude] - Note: This function expects [lat, lng]
 * @returns Barangay name or null if not found
 */
export function findContainingBarangay(coords: [number, number]): string | null {
  const [lat, lng] = coords;
  const point: [number, number] = [lng, lat]; // Convert to GeoJSON format [lng, lat]
  
  const features = barangayData.features as PolygonFeature[];
  
  for (const feature of features) {
    if (feature.geometry.type === 'Polygon') {
      // Check each ring of the polygon (first ring is exterior, others are holes)
      const exteriorRing = feature.geometry.coordinates[0];
      
      if (pointInPolygon(point, exteriorRing)) {
        // Check if point is in any holes (interior rings)
        let inHole = false;
        for (let i = 1; i < feature.geometry.coordinates.length; i++) {
          if (pointInPolygon(point, feature.geometry.coordinates[i])) {
            inHole = true;
            break;
          }
        }
        
        if (!inHole) {
          return feature.properties.BARANGAY || feature.properties.Name || 'Unknown';
        }
      }
    }
  }
  
  return null;
}

