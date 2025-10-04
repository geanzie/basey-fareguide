/**
 * Utility functions for working with Google Maps polylines and route visualization
 */

/**
 * Decode Google Maps polyline into array of coordinates
 * @param encoded - Encoded polyline string from Google Maps
 * @returns Array of [lat, lng] coordinate pairs
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charAt(index++).charCodeAt(0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charAt(index++).charCodeAt(0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Calculate bounds that contain all points in a route
 * @param points - Array of [lat, lng] coordinates
 * @returns Bounds object with north, south, east, west
 */
export function calculateRouteBounds(points: [number, number][]) {
  if (points.length === 0) {
    return null;
  }

  let north = points[0][0];
  let south = points[0][0];
  let east = points[0][1];
  let west = points[0][1];

  for (const [lat, lng] of points) {
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  }

  // Add some padding
  const padding = 0.01;
  return {
    north: north + padding,
    south: south - padding,
    east: east + padding,
    west: west - padding,
  };
}

/**
 * Generate SVG path from route coordinates for static display
 * @param points - Array of [lat, lng] coordinates
 * @param width - SVG width
 * @param height - SVG height
 * @returns SVG path string
 */
export function generateSVGPath(
  points: [number, number][],
  width: number,
  height: number
): { path: string; bounds: any } | null {
  if (points.length === 0) return null;

  const bounds = calculateRouteBounds(points);
  if (!bounds) return null;

  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;

  // Convert lat/lng to SVG coordinates
  const svgPoints = points.map(([lat, lng]) => {
    const x = ((lng - bounds.west) / lngRange) * width;
    const y = ((bounds.north - lat) / latRange) * height; // Flip Y axis
    return [x, y];
  });

  // Generate SVG path
  let path = `M ${svgPoints[0][0]} ${svgPoints[0][1]}`;
  for (let i = 1; i < svgPoints.length; i++) {
    path += ` L ${svgPoints[i][0]} ${svgPoints[i][1]}`;
  }

  return { path, bounds };
}