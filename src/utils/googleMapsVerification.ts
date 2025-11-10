// Google Maps API integration for coordinate verification
// Provides reverse geocoding and address validation

export interface GoogleMapsAddress {
  formattedAddress: string;
  addressComponents: Array<{
    longName: string;
    shortName: string;
    types: string[];
  }>;
  placeId: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    locationType: string;
    viewport: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
}

export interface GoogleMapsVerificationResult {
  isValidLocation: boolean;
  address: GoogleMapsAddress | null;
  municipality: string | null;
  province: string | null;
  country: string | null;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  placeTypes: string[];
}

/**
 * Reverse geocode coordinates using Google Maps API
 * @param coords [latitude, longitude]
 * @returns Promise with geocoding result
 */
export async function reverseGeocode(coords: [number, number], baseUrl?: string): Promise<GoogleMapsVerificationResult> {
  const [lat, lng] = coords;
  
  try {
    // Determine the URL to use
    // For browser context, use relative URL
    // For server-side context, baseUrl must be provided or we throw an error
    const apiUrl = baseUrl 
      ? `${baseUrl}/api/geocode/reverse`
      : (typeof window !== 'undefined' 
        ? '/api/geocode/reverse' 
        : null);
    
    // If no URL available (server-side without baseUrl), throw error - validation is required!
    if (!apiUrl) {
      throw new Error('Google Maps verification cannot be performed in server-side context without baseUrl. Please validate from the UI.');
    }
    
    // Use the API route instead of direct Google Maps API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return analyzeGeocodingResult(data.result);
  } catch (error) {
      // Return failed validation - this is critical for data accuracy
      return {
      isValidLocation: false,
      address: null,
      municipality: null,
      province: null,
      country: null,
      confidence: 'low',
      issues: [`Google Maps verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      placeTypes: [],
    };
  }
}

/**
 * Analyze Google Maps geocoding result
 * @param result Google Maps API result
 * @returns Structured verification result
 */
function analyzeGeocodingResult(result: any): GoogleMapsVerificationResult {
  if (!result || !result.results || result.results.length === 0) {
    return {
      isValidLocation: false,
      address: null,
      municipality: null,
      province: null,
      country: null,
      confidence: 'low',
      issues: ['No location found at these coordinates'],
      placeTypes: [],
    };
  }

  const firstResult = result.results[0];
  const address: GoogleMapsAddress = {
    formattedAddress: firstResult.formatted_address,
    addressComponents: firstResult.address_components || [],
    placeId: firstResult.place_id,
    geometry: firstResult.geometry,
  };

  // Extract location components
  let municipality: string | null = null;
  let province: string | null = null;
  let country: string | null = null;
  const placeTypes: string[] = firstResult.types || [];

  for (const component of address.addressComponents) {
    const types = component.types;
    
    if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      municipality = component.longName;
    } else if (types.includes('administrative_area_level_1')) {
      province = component.longName;
    } else if (types.includes('country')) {
      country = component.longName;
    }
  }

  // Analyze result quality
  const issues: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // Check if we're in the Philippines
  if (country !== 'Philippines') {
    issues.push(`Coordinates are in ${country}, not Philippines`);
    confidence = 'low';
  }

  // Check if we're in the correct province
  if (province && !province.toLowerCase().includes('samar')) {
    issues.push(`Coordinates are in ${province}, not Samar province`);
    confidence = 'low';
  }

  // Check if we're in the correct municipality
  if (municipality && !municipality.toLowerCase().includes('basey')) {
    issues.push(`Coordinates are in ${municipality}, not Basey municipality`);
    confidence = 'low';
  }

  // Check location precision based on place types
  const precisionTypes = ['premise', 'street_address', 'establishment', 'point_of_interest'];
  const approximateTypes = ['administrative_area_level_3', 'administrative_area_level_4', 'political'];
  
  if (placeTypes.some(type => precisionTypes.includes(type))) {
    // High precision result
    confidence = confidence === 'low' ? 'low' : 'high';
  } else if (placeTypes.some(type => approximateTypes.includes(type))) {
    // Approximate location
    if (confidence !== 'low') confidence = 'medium';
    issues.push('Coordinates appear to be approximate (administrative area level)');
  }

  // Check if it's a natural feature or landmark
  const naturalFeatures = ['natural_feature', 'park', 'campground'];
  if (placeTypes.some(type => naturalFeatures.includes(type))) {
    issues.push('Coordinates point to a natural feature or park area');
  }

  return {
    isValidLocation: true,
    address,
    municipality,
    province,
    country,
    confidence,
    issues,
    placeTypes,
  };
}

/**
 * Verify multiple coordinates in batch
 * @param locations Array of locations with coordinates
 * @returns Promise with array of verification results
 */
export async function batchVerifyCoordinates(
  locations: Array<{ name: string; coords: [number, number] }>
): Promise<Array<{ name: string; result: GoogleMapsVerificationResult }>> {
  const results: Array<{ name: string; result: GoogleMapsVerificationResult }> = [];
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (location) => {
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = await reverseGeocode(location.coords);
      return { name: location.name, result };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get suggestions for coordinate corrections based on Google Maps data
 * @param originalCoords Original coordinates that failed verification
 * @param locationName Name of the location
 * @returns Promise with suggested coordinates
 */
export async function getSuggestedCoordinates(
  originalCoords: [number, number],
  locationName: string
): Promise<{
  suggestedCoords: [number, number] | null;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  address: string | null;
}> {
  try {
    // Try to geocode by name within Basey bounds
    const response = await fetch('/api/geocode/forward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `${locationName}, Basey, Samar, Philippines`,
        bounds: {
          northeast: { lat: 11.45, lng: 125.20 },
          southwest: { lat: 11.10, lng: 124.90 }
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error || !data.results || data.results.length === 0) {
      return {
        suggestedCoords: null,
        confidence: 'low',
        method: 'geocoding_failed',
        address: null,
      };
    }

    const firstResult = data.results[0];
    const suggestedCoords: [number, number] = [
      firstResult.geometry.location.lat,
      firstResult.geometry.location.lng
    ];

    // Determine confidence based on result quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    const types = firstResult.types || [];
    
    if (types.includes('establishment') || types.includes('point_of_interest')) {
      confidence = 'high';
    } else if (types.includes('locality') || types.includes('sublocality')) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      suggestedCoords,
      confidence,
      method: 'google_geocoding',
      address: firstResult.formatted_address,
    };
  } catch (error) {
      return {
      suggestedCoords: null,
      confidence: 'low',
      method: 'error',
      address: null,
    };
  }
}
