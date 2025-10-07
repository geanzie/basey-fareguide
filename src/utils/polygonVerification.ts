// Polygon verification utility for checking if coordinates are within their actual barangay boundaries
// Uses GeoJSON data and point-in-polygon algorithms

const barangayData = require('../data/Barangay.shp.json');

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

export interface PolygonVerificationResult {
  isWithinCorrectBarangay: boolean;
  actualBarangay: string | null;
  expectedBarangay: string;
  distance: number; // Distance to nearest polygon edge in meters
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
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
 * Calculate distance from point to polygon edge using haversine formula
 * @param point [lng, lat]
 * @param polygon Array of [lng, lat] points
 * @returns Distance in meters to nearest edge
 */
function distanceToPolygonEdge(point: [number, number], polygon: number[][]): number {
  let minDistance = Infinity;
  
  for (let i = 0; i < polygon.length - 1; i++) {
    const distance = distanceToLineSegment(point, [polygon[i], polygon[i + 1]]);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

/**
 * Calculate distance from point to line segment
 * @param point [lng, lat]
 * @param segment [[lng1, lat1], [lng2, lat2]]
 * @returns Distance in meters
 */
function distanceToLineSegment(point: [number, number], segment: [number[], number[]]): number {
  const [px, py] = point;
  const [x1, y1] = segment[0];
  const [x2, y2] = segment[1];
  
  // Calculate the perpendicular distance from point to line segment
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  // Convert to meters using approximation (1 degree ≈ 111,320 meters)
  const distanceInDegrees = Math.sqrt(dx * dx + dy * dy);
  return distanceInDegrees * 111320;
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

/**
 * Verify if coordinates are within their expected barangay polygon
 * @param coords [latitude, longitude]
 * @param expectedBarangay Name of the expected barangay
 * @returns Verification result with details
 */
export function verifyCoordinatesInPolygon(
  coords: [number, number],
  expectedBarangay: string
): PolygonVerificationResult {
  const [lat, lng] = coords;
  const point: [number, number] = [lng, lat]; // Convert to GeoJSON format
  
  const actualBarangay = findContainingBarangay(coords);
  const isWithinCorrectBarangay = actualBarangay !== null && 
    actualBarangay.toLowerCase().replace(/[^a-z0-9]/g, '') === 
    expectedBarangay.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const issues: string[] = [];
  let distance = 0;
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  if (!isWithinCorrectBarangay) {
    if (actualBarangay) {
      issues.push(`Coordinates are located in ${actualBarangay}, not ${expectedBarangay}`);
      confidence = 'low';
    } else {
      issues.push(`Coordinates are not within any known barangay boundary in Basey Municipality`);
      confidence = 'low';
      
      // Find the closest polygon to calculate distance
      const features = barangayData.features as PolygonFeature[];
      let minDistance = Infinity;
      
      for (const feature of features) {
        if (feature.geometry.type === 'Polygon') {
          const polygonDistance = distanceToPolygonEdge(point, feature.geometry.coordinates[0]);
          minDistance = Math.min(minDistance, polygonDistance);
        }
      }
      
      distance = minDistance;
      
      if (distance < 100) {
        issues.push(`Coordinates are ${Math.round(distance)}m from nearest barangay boundary`);
        confidence = 'medium';
      } else if (distance < 500) {
        issues.push(`Coordinates are ${Math.round(distance)}m from nearest barangay boundary`);
        confidence = 'low';
      } else {
        issues.push(`Coordinates are ${(distance/1000).toFixed(1)}km from nearest barangay boundary`);
        confidence = 'low';
      }
    }
  }
  
  return {
    isWithinCorrectBarangay,
    actualBarangay,
    expectedBarangay,
    distance,
    confidence,
    issues
  };
}

/**
 * Calculate the centroid (center point) of a polygon
 * @param polygon Array of [longitude, latitude] points
 * @returns [longitude, latitude] of centroid
 */
function calculatePolygonCentroid(polygon: number[][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  
  for (let i = 0; i < polygon.length - 1; i++) {
    const x0 = polygon[i][0];
    const y0 = polygon[i][1];
    const x1 = polygon[i + 1][0];
    const y1 = polygon[i + 1][1];
    
    const a = x0 * y1 - x1 * y0;
    area += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  
  area *= 0.5;
  cx /= (6 * area);
  cy /= (6 * area);
  
  return [cx, cy];
}

/**
 * Get suggested coordinates for a barangay based on its polygon centroid
 * @param barangayName Name of the barangay
 * @returns [latitude, longitude] of suggested coordinates or null if not found
 */
export function getSuggestedCoordinatesForBarangay(barangayName: string): [number, number] | null {
  const features = barangayData.features as PolygonFeature[];
  
  // Find the barangay feature
  const targetFeature = features.find(feature => {
    const featureBarangay = feature.properties.BARANGAY || feature.properties.Name || '';
    return featureBarangay.toLowerCase().replace(/[^a-z0-9]/g, '') === 
           barangayName.toLowerCase().replace(/[^a-z0-9]/g, '');
  });
  
  if (!targetFeature || targetFeature.geometry.type !== 'Polygon') {
    return null;
  }
  
  // Calculate centroid of the main polygon (exterior ring)
  const exteriorRing = targetFeature.geometry.coordinates[0];
  const centroid = calculatePolygonCentroid(exteriorRing);
  
  // Convert from GeoJSON format [lng, lat] to our format [lat, lng]
  return [centroid[1], centroid[0]];
}

/**
 * Get corrected coordinates for a location that has coordinate issues
 * @param locationName Name of the location
 * @param expectedBarangay Name of the expected barangay
 * @param currentCoords Current coordinates [lat, lng]
 * @returns Suggested coordinates [lat, lng] or null if no suggestion available
 */
export function getAutomaticCoordinateFix(
  locationName: string,
  expectedBarangay: string,
  currentCoords: [number, number]
): { suggestedCoords: [number, number]; confidence: number; reason: string } | null {
  // First, try to get the centroid of the expected barangay
  const barangayCentroid = getSuggestedCoordinatesForBarangay(expectedBarangay);
  
  if (barangayCentroid) {
    return {
      suggestedCoords: barangayCentroid,
      confidence: 85,
      reason: `Suggested coordinates are the geographic center of ${expectedBarangay} barangay based on accurate GeoJSON boundaries`
    };
  }
  
  return null;
}

/**
 * Get all barangay names from the GeoJSON data
 * @returns Array of barangay names
 */
export function getAllBarangayNames(): string[] {
  const features = barangayData.features as PolygonFeature[];
  return features.map(feature => 
    feature.properties.BARANGAY || feature.properties.Name || 'Unknown'
  ).filter(name => name !== 'Unknown');
}

/**
 * Get barangay polygon coordinates for a specific barangay
 * @param barangayName Name of the barangay
 * @returns Polygon coordinates or null if not found
 */
export function getBarangayPolygon(barangayName: string): number[][][] | null {
  const features = barangayData.features as PolygonFeature[];
  const normalizedName = barangayName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const feature of features) {
    const featureName = (feature.properties.BARANGAY || feature.properties.Name || '');
    const normalizedFeatureName = featureName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (normalizedFeatureName === normalizedName) {
      return feature.geometry.coordinates;
    }
  }
  
  return null;
}

/**
 * Calculate the centroid of a barangay polygon
 * @param barangayName Name of the barangay
 * @returns Centroid coordinates [lat, lng] or null if not found
 */
export function getBarangayCentroid(barangayName: string): [number, number] | null {
  const polygon = getBarangayPolygon(barangayName);
  
  if (!polygon || polygon.length === 0) {
    return null;
  }
  
  const exteriorRing = polygon[0];
  let sumLat = 0;
  let sumLng = 0;
  
  for (const point of exteriorRing) {
    sumLng += point[0]; // longitude
    sumLat += point[1]; // latitude
  }
  
  const centroidLng = sumLng / exteriorRing.length;
  const centroidLat = sumLat / exteriorRing.length;
  
  return [centroidLat, centroidLng]; // Return as [lat, lng]
}