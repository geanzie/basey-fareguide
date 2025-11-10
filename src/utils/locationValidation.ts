// Location validation utilities for admin location management
// Validates coordinates against municipality boundaries and Google Maps API

import { reverseGeocode, GoogleMapsVerificationResult } from './googleMapsVerification';
import { findContainingBarangay } from './polygonVerification';

export interface LocationValidationRequest {
  name: string;
  coordinates: string; // Format: "lat,lng"
  barangay?: string;
  type: 'BARANGAY' | 'LANDMARK' | 'URBAN' | 'RURAL';
  description?: string;
}

export interface LocationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  
  // Boundary validation
  withinMunicipality: boolean;
  withinBarangay: boolean;
  detectedBarangay: string | null;
  expectedBarangay: string | null;
  
  // Google Maps validation
  googleMapsValid: boolean;
  googlePlaceId: string | null;
  googleAddress: string | null;
  googleConfidence: 'high' | 'medium' | 'low';
  googleMapsResult?: GoogleMapsVerificationResult;
  
  // Coordinate analysis
  parsedCoordinates: {
    lat: number;
    lng: number;
  } | null;
  
  // Recommendations
  recommendations: string[];
}

/**
 * Parse coordinate string into lat/lng numbers
 */
function parseCoordinates(coordinates: string): { lat: number; lng: number } | null {
  try {
    const parts = coordinates.trim().split(',').map(s => s.trim());
    
    if (parts.length !== 2) {
      return null;
    }
    
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    
    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }
    
    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    
    return { lat, lng };
  } catch (error) {
    return null;
  }
}

/**
 * Validate coordinates are within reasonable range for Basey, Samar
 * Extended bounds to include all tourist destinations and remote barangays
 */
function validateCoordinateRange(lat: number, lng: number): { valid: boolean; message?: string } {
  // Basey, Samar extended bounds (includes Sohoton and other remote locations)
  const BASEY_BOUNDS = {
    minLat: 11.15,  // Extended south to include southern barangays
    maxLat: 11.50,  // Extended north to include Sohoton and northern areas
    minLng: 125.00, // Western boundary
    maxLng: 125.20  // Extended east to include eastern tourist destinations
  };
  
  // Only show warning for coordinates significantly outside bounds
  if (lat < BASEY_BOUNDS.minLat || lat > BASEY_BOUNDS.maxLat ||
      lng < BASEY_BOUNDS.minLng || lng > BASEY_BOUNDS.maxLng) {
    return {
      valid: false,
      message: `Coordinates (${lat}, ${lng}) may be outside Basey municipality. Expected range: lat ${BASEY_BOUNDS.minLat}-${BASEY_BOUNDS.maxLat}, lng ${BASEY_BOUNDS.minLng}-${BASEY_BOUNDS.maxLng}`
    };
  }
  
  return { valid: true };
}

/**
 * Comprehensive location validation
 * @param request Location data to validate
 * @param baseUrl Optional base URL for server-side Google Maps API calls
 */
export async function validateLocation(
  request: LocationValidationRequest,
  baseUrl?: string
): Promise<LocationValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  let withinMunicipality = false;
  let withinBarangay = false;
  let detectedBarangay: string | null = null;
  let googleMapsValid = false;
  let googlePlaceId: string | null = null;
  let googleAddress: string | null = null;
  let googleConfidence: 'high' | 'medium' | 'low' = 'low';
  let googleMapsResult: GoogleMapsVerificationResult | undefined;
  
  // 1. Validate required fields
  if (!request.name || request.name.trim().length === 0) {
    errors.push('Location name is required');
  }
  
  if (!request.coordinates || request.coordinates.trim().length === 0) {
    errors.push('Coordinates are required');
  }
  
  // 2. Parse and validate coordinates format
  const parsedCoords = parseCoordinates(request.coordinates);
  
  if (!parsedCoords) {
    errors.push('Invalid coordinate format. Expected format: "latitude,longitude" (e.g., "11.2727,125.0627")');
    
    return {
      isValid: false,
      errors,
      warnings,
      withinMunicipality: false,
      withinBarangay: false,
      detectedBarangay: null,
      expectedBarangay: request.barangay || null,
      googleMapsValid: false,
      googlePlaceId: null,
      googleAddress: null,
      googleConfidence: 'low',
      parsedCoordinates: null,
      recommendations
    };
  }
  
  // 3. Validate coordinate range (warning only for remote locations)
  const rangeCheck = validateCoordinateRange(parsedCoords.lat, parsedCoords.lng);
  if (!rangeCheck.valid) {
    warnings.push(rangeCheck.message!);
    warnings.push('Coordinates may be in remote areas of Basey or neighboring municipality.');
    recommendations.push('Verify this is the correct location using Google Maps');
  }
  
  // 4. Check if within municipality boundaries
  // Using barangay detection as proxy for municipality check
  try {
    const detectedBrgy = findContainingBarangay([parsedCoords.lng, parsedCoords.lat]);
    withinMunicipality = detectedBrgy !== null;
    
    if (!withinMunicipality) {
      // For landmarks and tourist destinations, this might be expected
      if (request.type === 'LANDMARK') {
        warnings.push('Landmark coordinates are outside mapped barangay boundaries');
        recommendations.push('This is normal for tourist destinations in remote areas');
        recommendations.push('Verify the location is accessible from Basey');
        // Don't fail validation for landmarks outside barangay boundaries
        withinMunicipality = true; // Allow landmarks anywhere within extended bounds
      } else {
        warnings.push('Coordinates are not within mapped barangay boundaries');
        recommendations.push('Verify the coordinates using Google Maps');
        recommendations.push('Check if this is in a remote or unmapped area');
      }
    }
  } catch (error) {
    warnings.push('Could not verify municipality boundaries: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
  
  // 5. Detect which barangay contains the coordinates
  try {
    detectedBarangay = findContainingBarangay([parsedCoords.lng, parsedCoords.lat]);
    
    if (detectedBarangay) {
      withinBarangay = true;
      
      // Compare with expected barangay if provided
      if (request.barangay) {
        const normalizedDetected = detectedBarangay.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedExpected = request.barangay.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (normalizedDetected !== normalizedExpected) {
          warnings.push(`Coordinates are in "${detectedBarangay}" but expected barangay is "${request.barangay}"`);
          recommendations.push('Verify the barangay name or adjust coordinates');
        }
      }
    } else {
      warnings.push('Could not determine which barangay contains these coordinates');
      withinBarangay = false;
    }
  } catch (error) {
    warnings.push('Could not verify barangay boundaries: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
  
  // 6. Validate with Google Maps API - REQUIRED for data accuracy
  try {
    googleMapsResult = await reverseGeocode([parsedCoords.lat, parsedCoords.lng], baseUrl);
    
    googleMapsValid = googleMapsResult.isValidLocation;
    googlePlaceId = googleMapsResult.address?.placeId || null;
    googleAddress = googleMapsResult.address?.formattedAddress || null;
    googleConfidence = googleMapsResult.confidence;
    
    if (!googleMapsValid) {
      // Google Maps failed - this is a critical error for data accuracy
      errors.push('Google Maps could not verify this location');
      if (googleMapsResult.issues.length > 0) {
        errors.push(...googleMapsResult.issues);
      }
      recommendations.push('Double-check coordinates using Google Maps manually');
      recommendations.push('Ensure coordinates are in correct format (latitude,longitude)');
    } else if (googleMapsResult.address) {
      // Check municipality match - this ensures location is actually in Basey
      if (googleMapsResult.municipality) {
        const normalizedMunicipality = googleMapsResult.municipality.toLowerCase();
        if (!normalizedMunicipality.includes('basey')) {
          // For landmarks like Sohoton, they may technically be in neighboring areas
          // but are considered part of Basey's tourist destinations
          if (request.type === 'LANDMARK') {
            warnings.push(`Google Maps shows this is in "${googleMapsResult.municipality}"`);
            recommendations.push('Verify this landmark is accessible from or associated with Basey');
          } else {
            errors.push(`Google Maps indicates this location is in "${googleMapsResult.municipality}", not Basey`);
            recommendations.push('Verify the coordinates are correct for Basey municipality');
          }
        }
      }
      
      // Confidence-based quality checks
      if (googleConfidence === 'low') {
        warnings.push('Google Maps confidence is low for this location');
        recommendations.push('Consider using more precise coordinates if available');
      } else if (googleConfidence === 'medium') {
        recommendations.push('Location verified with medium confidence.');
      } else {
        recommendations.push('✓ Location verified with high confidence from Google Maps');
      }
      
      // Show what Google Maps found
      if (googleAddress) {
        recommendations.push(`Google Maps address: ${googleAddress}`);
      }
    }
  } catch (error) {
    // Critical error - we need Google Maps validation for accuracy
    errors.push('Google Maps validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    recommendations.push('Please validate from the admin UI where Google Maps is available');
    recommendations.push('This ensures location accuracy and reliability');
  }
  
  // 7. Type-specific validation
  if (request.type === 'BARANGAY' && !request.barangay) {
    warnings.push('Barangay name should be specified for BARANGAY type locations');
  }
  
  if (request.type === 'LANDMARK' && (!request.description || request.description.trim().length < 10)) {
    warnings.push('Landmarks should have a detailed description');
    recommendations.push('Add description of what makes this location a landmark');
  }
  
  // 8. Name validation
  if (request.name.length < 3) {
    warnings.push('Location name is very short');
  }
  
  if (request.name.length > 100) {
    warnings.push('Location name is very long. Consider shortening it.');
  }
  
  // Determine overall validity
  const isValid = errors.length === 0 && withinMunicipality;
  
  return {
    isValid,
    errors,
    warnings,
    withinMunicipality,
    withinBarangay,
    detectedBarangay,
    expectedBarangay: request.barangay || null,
    googleMapsValid,
    googlePlaceId,
    googleAddress,
    googleConfidence,
    googleMapsResult,
    parsedCoordinates: parsedCoords,
    recommendations
  };
}

/**
 * Quick validation for coordinate format only
 */
export function validateCoordinateFormat(coordinates: string): {
  valid: boolean;
  lat?: number;
  lng?: number;
  error?: string;
} {
  const parsed = parseCoordinates(coordinates);
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid format. Use: "latitude,longitude" (e.g., "11.2727,125.0627")'
    };
  }
  
  const rangeCheck = validateCoordinateRange(parsed.lat, parsed.lng);
  if (!rangeCheck.valid) {
    return {
      valid: false,
      lat: parsed.lat,
      lng: parsed.lng,
      error: rangeCheck.message
    };
  }
  
  return {
    valid: true,
    lat: parsed.lat,
    lng: parsed.lng
  };
}

/**
 * Generate Google Maps URL for visual verification
 */
export function generateMapsUrl(coordinates: string, name?: string): string {
  const parsed = parseCoordinates(coordinates);
  
  if (!parsed) {
    return '';
  }
  
  const query = name ? encodeURIComponent(name) : `${parsed.lat},${parsed.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
