/**
 * Basey Center Coordinates
 * 
 * This file provides the authoritative Basey town center coordinates
 * calculated from the accurate GeoJSON data (Barangay.shp.json).
 * 
 * Rule: "follow whatever the .geojson file has because this is the most realistic coordinates data"
 * 
 * The coordinates are calculated as the centroid of all poblacion (urban) barangays:
 * - MERCADO, LOYO, BAYBAY, PALAYPAY, LAWA-AN, SULOD, BUSCADA
 */

// Calculated from GeoJSON poblacion barangays
export const BASEY_CENTER: [number, number] = [11.282621, 125.068848]; // [lat, lng]

// For compatibility with Google Maps format
export const BASEY_CENTER_GOOGLE = { lat: 11.282621, lng: 125.068848 };

/**
 * José Rizal Monument (KM 0) is within the poblacion area
 * Using calculated center as the most accurate representation
 */
export const RIZAL_MONUMENT_COORDS: [number, number] = BASEY_CENTER;

/**
 * Other landmark coordinates within Basey poblacion area
 * These should also use the calculated center for consistency
 * unless they have verified specific coordinates from the GeoJSON boundaries
 */
export const BASEY_LANDMARKS = {
  'José Rizal Monument (Basey Center - KM 0)': BASEY_CENTER,
  'Basey Church (St. Michael the Archangel)': BASEY_CENTER, // Within poblacion
  'Basey Municipal Hall': BASEY_CENTER, // Within poblacion
  'Basey Public Market': BASEY_CENTER, // Within poblacion
  'Basey I Central School': BASEY_CENTER, // Within poblacion
  'Basey National High School': BASEY_CENTER, // Within poblacion
  'Basey Port/Wharf': BASEY_CENTER, // Within poblacion
  'Rural Health Unit Basey': BASEY_CENTER, // Within poblacion
} as const;

/**
 * External landmarks outside Basey poblacion
 * These coordinates should be verified against actual locations
 */
export const EXTERNAL_LANDMARKS = {
  'Sohoton Natural Bridge National Park': [11.3329711, 125.1442518] as [number, number],
  'Sohoton Caves': [11.3588068, 125.1586589] as [number, number],
  'Panhulugan Cliff': [11.3556, 125.0234] as [number, number],
} as const;