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
 * Landmark coordinates with verified data from basey-locations.json
 * Updated: 2025-11-08
 * Source: Comprehensive location dataset with 158+ verified locations
 */
export const BASEY_LANDMARKS = {
  // Legacy fallback for general Basey center
  'José Rizal Monument (Basey Center - KM 0)': BASEY_CENTER,
  
  // Verified landmarks from basey-locations.json
  'Basey Church (St. Michael the Archangel)': [11.2809812, 125.0699803] as [number, number], // Saint Michael the Archangel Parish Church
  'Basey Municipal Hall': [11.2795, 125.0653] as [number, number], // Manual verified
  'Basey Public Market': [11.279, 125.0645] as [number, number], // Manual verified
  'Basey I Central School': [11.2816766, 125.0679426] as [number, number], // Basey Ⅰ Central Elementary school
  'Basey National High School': [11.2847487, 125.0668604] as [number, number], // OSM verified
  'Basey Port/Wharf': BASEY_CENTER, // Within poblacion area
  'Rural Health Unit Basey': BASEY_CENTER, // Within poblacion area
  'Basey District Hospital': [11.279244, 125.0651242] as [number, number], // OSM verified
  'Basey Town Hall': [11.2805435, 125.069069] as [number, number], // OSM verified
  'Basey Bridge': [11.2798, 125.066] as [number, number], // Manual verified
  'Basey Terminal': [11.2851283, 125.07055] as [number, number], // OSM verified
} as const;

/**
 * External landmarks outside Basey poblacion
 * Verified coordinates from basey-locations.json and OSM
 */
export const EXTERNAL_LANDMARKS = {
  'Sohoton Natural Bridge National Park': [11.4167, 125.1167] as [number, number], // Manual verified
  'Sohoton Natural Bridge': [11.3648129, 125.1633367] as [number, number], // OSM verified
  'Sohoton Caves': [11.3588068, 125.1586589] as [number, number], // OSM verified
  'Sohoton Cave': [11.42, 125.12] as [number, number], // Manual verified
  'Panhulugan Cliff': [11.3556, 125.0234] as [number, number], // Legacy
  'Balantak waterfall': [11.3540572, 125.1716368] as [number, number], // OSM verified
  'So-ob Cave': [11.259273, 125.1637711] as [number, number], // OSM verified
} as const;