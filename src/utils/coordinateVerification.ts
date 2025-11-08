// Enhanced Coordinate Verification Utility for Basey Municipality
// This utility helps validate and analyze coordinate accuracy using:
// 1. Geographic bounds checking
// 2. Polygon verification against GeoJSON data
// 3. Google Maps API validation

import { verifyCoordinatesInPolygon, findContainingBarangay } from './polygonVerification';
import { reverseGeocode } from './googleMapsVerification';

export interface Location {
  name: string;
  coords: [number, number]; // [latitude, longitude]
  type: 'rural' | 'urban' | 'landmark';
}

export interface CoordinateAnalysis {
  name: string;
  coords: [number, number];
  type: string;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
  googleMapsUrl: string;
  distanceFromCenter: number;
  polygonVerification?: {
    isWithinCorrectBarangay: boolean;
    actualBarangay: string | null;
    confidence: 'high' | 'medium' | 'low';
  };
  googleMapsVerification?: {
    isValidLocation: boolean;
    municipality: string | null;
    province: string | null;
    confidence: 'high' | 'medium' | 'low';
    address: string | null;
  };
}

// Basey Municipality approximate bounds (based on geographical data)
const BASEY_BOUNDS = {
  // More precise bounds for Basey Municipality
  latMin: 11.15,   // Southern boundary
  latMax: 11.45,   // Northern boundary  
  lonMin: 124.95,  // Western boundary
  lonMax: 125.20   // Eastern boundary
};

// Center of Basey (José Rizal Monument - KM 0)
// Import the authoritative Basey center coordinates
import { BASEY_CENTER } from './baseyCenter';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371; // Earth's radius in kilometers
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate Google Maps URL for coordinate verification
 */
export function generateGoogleMapsUrl(coords: [number, number], name: string): string {
  const [lat, lon] = coords;
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lon},15z`;
}

/**
 * Analyze a single location's coordinates for potential issues
 */
export function analyzeCoordinate(location: Location): CoordinateAnalysis {
  const [lat, lon] = location.coords;
  const issues: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Basic bounds checking
  if (lat < BASEY_BOUNDS.latMin || lat > BASEY_BOUNDS.latMax) {
    issues.push(`Latitude ${lat} is outside expected Basey bounds (${BASEY_BOUNDS.latMin} to ${BASEY_BOUNDS.latMax})`);
    severity = 'high';
  }

  if (lon < BASEY_BOUNDS.lonMin || lon > BASEY_BOUNDS.lonMax) {
    issues.push(`Longitude ${lon} is outside expected Basey bounds (${BASEY_BOUNDS.lonMin} to ${BASEY_BOUNDS.lonMax})`);
    severity = 'high';
  }

  // Calculate distance from Basey center
  const distanceFromCenter = calculateDistance(location.coords, BASEY_CENTER);

  if (distanceFromCenter > 25) {
    issues.push(`Location is ${distanceFromCenter.toFixed(2)}km from Basey center - seems too far`);
    severity = severity === 'high' ? 'high' : 'medium';
  }

  // Precision checks
  const latDecimals = (lat.toString().split('.')[1] || '').length;
  const lonDecimals = (lon.toString().split('.')[1] || '').length;
  
  if (latDecimals > 10 || lonDecimals > 10) {
    issues.push('Coordinates have unusually high precision - may be copied incorrectly');
    severity = severity === 'high' ? 'high' : 'medium';
  }

  if (lat === Math.round(lat * 100) / 100 || lon === Math.round(lon * 100) / 100) {
    issues.push('Coordinates appear to be rounded - may lack precision');
    if (severity === 'low') severity = 'medium';
  }

  // Polygon verification (synchronous)
  let polygonVerification;
  try {
    const polygonResult = verifyCoordinatesInPolygon(location.coords, location.name);
    polygonVerification = {
      isWithinCorrectBarangay: polygonResult.isWithinCorrectBarangay,
      actualBarangay: polygonResult.actualBarangay,
      confidence: polygonResult.confidence,
    };
    
    if (!polygonResult.isWithinCorrectBarangay) {
      issues.push(...polygonResult.issues);
      if (polygonResult.confidence === 'low') {
        severity = 'high';
      } else if (polygonResult.confidence === 'medium' && severity === 'low') {
        severity = 'medium';
      }
    }
  } catch (error) {
      issues.push('Failed to verify coordinates against barangay boundaries');
    polygonVerification = {
      isWithinCorrectBarangay: false,
      actualBarangay: null,
      confidence: 'low' as const,
    };
  }

  return {
    name: location.name,
    coords: location.coords,
    type: location.type,
    issues,
    severity,
    googleMapsUrl: generateGoogleMapsUrl(location.coords, location.name),
    distanceFromCenter,
    polygonVerification
  };
}

/**
 * Analyze a single location's coordinates with Google Maps verification (async)
 */
export async function analyzeCoordinateWithGoogleMaps(location: Location): Promise<CoordinateAnalysis> {
  // Get basic analysis first
  const basicAnalysis = analyzeCoordinate(location);
  
  // Add Google Maps verification
  let googleMapsVerification;
  try {
    const googleResult = await reverseGeocode(location.coords);
    googleMapsVerification = {
      isValidLocation: googleResult.isValidLocation,
      municipality: googleResult.municipality,
      province: googleResult.province,
      confidence: googleResult.confidence,
      address: googleResult.address?.formattedAddress || null,
    };
    
    // Add Google Maps issues to the analysis
    if (googleResult.issues.length > 0) {
      basicAnalysis.issues.push(...googleResult.issues);
      
      // Update severity based on Google Maps results
      if (googleResult.confidence === 'low' && !googleResult.isValidLocation) {
        basicAnalysis.severity = 'high';
      } else if (googleResult.confidence === 'medium' && basicAnalysis.severity === 'low') {
        basicAnalysis.severity = 'medium';
      }
    }
  } catch (error) {
      basicAnalysis.issues.push('Failed to verify coordinates with Google Maps API');
    googleMapsVerification = {
      isValidLocation: false,
      municipality: null,
      province: null,
      confidence: 'low' as const,
      address: null,
    };
  }
  
  return {
    ...basicAnalysis,
    googleMapsVerification
  };
}

/**
 * Analyze all locations and return a comprehensive report
 */
export function analyzeAllCoordinates(locations: Location[]): {
  summary: {
    total: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    clean: number;
  };
  analyses: CoordinateAnalysis[];
  flaggedLocations: CoordinateAnalysis[];
} {
  const analyses = locations.map(analyzeCoordinate);
  
  const highIssues = analyses.filter(a => a.severity === 'high');
  const mediumIssues = analyses.filter(a => a.severity === 'medium');
  const lowIssues = analyses.filter(a => a.severity === 'low' && a.issues.length > 0);
  const clean = analyses.filter(a => a.issues.length === 0);

  const flaggedLocations = analyses.filter(a => a.issues.length > 0);

  return {
    summary: {
      total: locations.length,
      highIssues: highIssues.length,
      mediumIssues: mediumIssues.length,
      lowIssues: lowIssues.length,
      clean: clean.length
    },
    analyses,
    flaggedLocations
  };
}

/**
 * Generate a batch verification URL for Google Maps
 */
export function generateBatchVerificationScript(locations: Location[]): string {
  const flaggedLocations = locations.filter(location => {
    const analysis = analyzeCoordinate(location);
    return analysis.severity === 'high' || analysis.severity === 'medium';
  });

  return `
// Batch Coordinate Verification Script
// Copy and paste this into your browser console on any webpage

const locations = ${JSON.stringify(flaggedLocations.map(loc => ({
  name: loc.name,
  coords: loc.coords,
  url: generateGoogleMapsUrl(loc.coords, loc.name)
})), null, 2)};locations.forEach((loc, index) => {
});

// Uncomment the next line to automatically open all URLs (use with caution)
// locations.forEach((loc, index) => setTimeout(() => window.open(loc.url), index * 2000));
`;
}

/**
 * Check for duplicate coordinates
 */
export function findDuplicateCoordinates(locations: Location[]): Array<{
  coords: [number, number];
  locations: string[];
}> {
  const coordMap = new Map<string, string[]>();

  locations.forEach(location => {
    const coordKey = `${location.coords[0]},${location.coords[1]}`;
    if (!coordMap.has(coordKey)) {
      coordMap.set(coordKey, []);
    }
    coordMap.get(coordKey)!.push(location.name);
  });

  return Array.from(coordMap.entries())
    .filter(([_, names]) => names.length > 1)
    .map(([coordStr, names]) => ({
      coords: coordStr.split(',').map(Number) as [number, number],
      locations: names
    }));
}

/**
 * Analyze all locations with enhanced verification (including Google Maps)
 */
export async function analyzeAllCoordinatesEnhanced(locations: Location[]): Promise<{
  summary: {
    total: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    clean: number;
    polygonMismatches: number;
    googleMapsFailures: number;
  };
  analyses: CoordinateAnalysis[];
  flaggedLocations: CoordinateAnalysis[];
}> {
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 5;
  const analyses: CoordinateAnalysis[] = [];
  
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);    const batchPromises = batch.map(location => analyzeCoordinateWithGoogleMaps(location));
    const batchResults = await Promise.all(batchPromises);
    analyses.push(...batchResults);
    
    // Add delay between batches to respect API limits
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const highIssues = analyses.filter(a => a.severity === 'high');
  const mediumIssues = analyses.filter(a => a.severity === 'medium');
  const lowIssues = analyses.filter(a => a.severity === 'low' && a.issues.length > 0);
  const clean = analyses.filter(a => a.issues.length === 0);
  const polygonMismatches = analyses.filter(a => a.polygonVerification && !a.polygonVerification.isWithinCorrectBarangay);
  const googleMapsFailures = analyses.filter(a => a.googleMapsVerification && !a.googleMapsVerification.isValidLocation);

  const flaggedLocations = analyses.filter(a => a.issues.length > 0);


  return {
    summary: {
      total: locations.length,
      highIssues: highIssues.length,
      mediumIssues: mediumIssues.length,
      lowIssues: lowIssues.length,
      clean: clean.length,
      polygonMismatches: polygonMismatches.length,
      googleMapsFailures: googleMapsFailures.length,
    },
    analyses,
    flaggedLocations
  };
}

/**
 * Suggest corrections for common coordinate issues
 */
export function suggestCorrections(location: Location): string[] {
  const analysis = analyzeCoordinate(location);
  const suggestions: string[] = [];

  if (analysis.issues.some(issue => issue.includes('outside expected Basey bounds'))) {
    suggestions.push('Verify the barangay name and check if coordinates belong to a different municipality');
    suggestions.push('Double-check the latitude/longitude order (should be [lat, lon])');
  }

  if (analysis.distanceFromCenter > 20) {
    suggestions.push('This location seems very far from Basey center - verify it belongs to Basey Municipality');
  }

  if (analysis.issues.some(issue => issue.includes('unusually high precision'))) {
    suggestions.push('Round coordinates to 6-7 decimal places for practical accuracy');
  }

  if (analysis.issues.some(issue => issue.includes('appear to be rounded'))) {
    suggestions.push('Consider using more precise coordinates from GPS or Google Maps');
  }

  return suggestions;
}
