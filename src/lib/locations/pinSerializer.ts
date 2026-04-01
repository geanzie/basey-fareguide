/**
 * Centralized serialization helpers for pin-based location labels stored in the database.
 *
 * Format: "pin:<lat>,<lng>"
 * Rules:
 *   - Always 6 decimal places (toFixed(6))
 *   - No spaces
 *   - Always lat,lng order
 *   - Prefix is exactly "pin:"
 *
 * Example: serializePinLabel(11.278823, 125.001194) → "pin:11.278823,125.001194"
 */

const PREFIX = "pin:";
const PRECISION = 6;

export function serializePinLabel(lat: number, lng: number): string {
  return `${PREFIX}${lat.toFixed(PRECISION)},${lng.toFixed(PRECISION)}`;
}

export function parsePinLabel(
  label: string,
): { lat: number; lng: number } | null {
  if (!label.startsWith(PREFIX)) return null;
  const parts = label.slice(PREFIX.length).split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
