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

function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) {
    sgnNum = ~sgnNum;
  }
  let output = "";
  while (sgnNum >= 0x20) {
    output += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  output += String.fromCharCode(sgnNum + 63);
  return output;
}

/**
 * Encode an array of [lat, lng] coordinate pairs into a Google polyline string.
 * Inverse of decodePolyline — lets locally computed (offline) routes flow
 * through the same polyline draw + fit-bounds pipeline as provider routes.
 */
export function encodePolyline(coordinates: [number, number][]): string {
  let output = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coordinates) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    output += encodeSignedNumber(iLat - prevLat);
    output += encodeSignedNumber(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }

  return output;
}