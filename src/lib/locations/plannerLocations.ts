import { LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  LocationCoordinatesDto as PlannerCoordinates,
  PlannerLocationCategory,
  PlannerLocationDto as PlannerLocation,
} from "@/lib/contracts";

interface PlannerLocationRow {
  id: string;
  name: string;
  type: LocationType;
  coordinates: string;
  barangay: string | null;
  description: string | null;
  googleFormattedAddress: string | null;
  updatedAt: Date;
}

function parseCoordinates(coordinates: string): PlannerCoordinates | null {
  const [latPart, lngPart] = coordinates.split(",");
  const lat = Number.parseFloat(latPart?.trim() ?? "");
  const lng = Number.parseFloat(lngPart?.trim() ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getPlannerCategory(type: LocationType): PlannerLocationCategory {
  if (type === "BARANGAY") return "barangay";
  if (type === "SITIO") return "sitio";
  return "landmark";
}

function toPlannerLocation(row: PlannerLocationRow): PlannerLocation | null {
  const coordinates = parseCoordinates(row.coordinates);
  if (!coordinates) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: getPlannerCategory(row.type),
    coordinates,
    address: row.googleFormattedAddress || `${row.name}, Basey, Samar`,
    verified: true,
    source: "database",
    barangay: row.barangay || undefined,
    description: row.description || undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const plannerLocationSelect = {
  id: true,
  name: true,
  type: true,
  coordinates: true,
  barangay: true,
  description: true,
  googleFormattedAddress: true,
  updatedAt: true,
} as const;

export async function listPlannerLocations(): Promise<PlannerLocation[]> {
  const rows = await prisma.location.findMany({
    where: {
      isActive: true,
      validationStatus: "VALIDATED",
    },
    select: plannerLocationSelect,
    orderBy: { name: "asc" },
  });

  return rows
    .map(toPlannerLocation)
    .filter((location): location is PlannerLocation => location !== null);
}

export async function resolvePlannerLocationByName(
  name: string,
): Promise<PlannerLocation | null> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return null;
  }

  const row = await prisma.location.findFirst({
    where: {
      name: { equals: normalizedName, mode: "insensitive" },
      isActive: true,
      validationStatus: "VALIDATED",
    },
    select: plannerLocationSelect,
  });

  if (!row) {
    return null;
  }

  return toPlannerLocation(row);
}
