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

interface GoogleMapsApiAddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

interface GoogleMapsApiResultItem {
  formatted_address: string;
  address_components?: GoogleMapsApiAddressComponent[];
  place_id: string;
  geometry: GoogleMapsAddress['geometry'];
  types?: string[];
}

interface GoogleMapsApiResult {
  results?: GoogleMapsApiResultItem[];
}

/**
 * Reverse geocode coordinates using Google Maps API
 * @param coords [latitude, longitude]
 * @returns Promise with geocoding result
 */
export async function reverseGeocode(
  coords: [number, number],
  baseUrl?: string,
): Promise<GoogleMapsVerificationResult> {
  const [lat, lng] = coords;

  try {
    const apiUrl = baseUrl
      ? `${baseUrl}/api/geocode/reverse`
      : typeof window !== 'undefined'
        ? '/api/geocode/reverse'
        : null;

    if (!apiUrl) {
      throw new Error('Google Maps verification cannot be performed in server-side context without baseUrl. Please validate from the UI.');
    }

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

function analyzeGeocodingResult(result: GoogleMapsApiResult | null | undefined): GoogleMapsVerificationResult {
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

  let municipality: string | null = null;
  let province: string | null = null;
  let country: string | null = null;
  const placeTypes: string[] = firstResult.types || [];

  for (const component of address.addressComponents) {
    const componentTypes = component.types;

    if (componentTypes.includes('locality') || componentTypes.includes('administrative_area_level_2')) {
      municipality = component.longName;
    } else if (componentTypes.includes('administrative_area_level_1')) {
      province = component.longName;
    } else if (componentTypes.includes('country')) {
      country = component.longName;
    }
  }

  const issues: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';

  if (country !== 'Philippines') {
    issues.push(`Coordinates are in ${country}, not Philippines`);
    confidence = 'low';
  }

  if (province && !province.toLowerCase().includes('samar')) {
    issues.push(`Coordinates are in ${province}, not Samar province`);
    confidence = 'low';
  }

  if (municipality && !municipality.toLowerCase().includes('basey')) {
    issues.push(`Coordinates are in ${municipality}, not Basey municipality`);
    confidence = 'low';
  }

  const precisionTypes = ['premise', 'street_address', 'establishment', 'point_of_interest'];
  const approximateTypes = ['administrative_area_level_3', 'administrative_area_level_4', 'political'];

  if (placeTypes.some((type) => precisionTypes.includes(type))) {
    confidence = confidence === 'low' ? 'low' : 'high';
  } else if (placeTypes.some((type) => approximateTypes.includes(type))) {
    if (confidence !== 'low') {
      confidence = 'medium';
    }
    issues.push('Coordinates appear to be approximate (administrative area level)');
  }

  const naturalFeatures = ['natural_feature', 'park', 'campground'];
  if (placeTypes.some((type) => naturalFeatures.includes(type))) {
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
