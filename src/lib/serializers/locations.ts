import type {
  LocationCoordinatesDto,
  LocationRideAccessDto,
  PlaceVehicleAccess,
} from "@/lib/contracts";

interface LocationRideAccessRecord {
  id: string;
  name: string;
  barangay: string | null;
  coordinates: string;
  vehicleAccess: PlaceVehicleAccess;
  dropoffCoordinates: string | null;
  accessNote: string | null;
  accessVerifiedAt: Date | null;
  updatedAt: Date;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Parses the `"lat,lng"` string columns Location stores coordinates in. */
export function parseLocationCoordinates(
  coordinates: string | null,
): LocationCoordinatesDto | null {
  if (!coordinates) return null;

  const [latPart, lngPart] = coordinates.split(",");
  const lat = Number.parseFloat(latPart?.trim() ?? "");
  const lng = Number.parseFloat(lngPart?.trim() ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

export function formatLocationCoordinates(point: LocationCoordinatesDto): string {
  return `${point.lat},${point.lng}`;
}

export function serializeLocationRideAccess(
  record: LocationRideAccessRecord,
): LocationRideAccessDto {
  return {
    id: record.id,
    name: record.name,
    barangay: record.barangay ?? null,
    coordinates: parseLocationCoordinates(record.coordinates) ?? { lat: 0, lng: 0 },
    vehicleAccess: record.vehicleAccess,
    dropoffCoordinates: parseLocationCoordinates(record.dropoffCoordinates),
    accessNote: record.accessNote ?? null,
    accessVerifiedAt: toIsoString(record.accessVerifiedAt),
    updatedAt: record.updatedAt.toISOString(),
  };
}
