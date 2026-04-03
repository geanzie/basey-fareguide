import { NextRequest, NextResponse } from "next/server";
import { PermitStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { serializeVehicleLookup } from "@/lib/serializers";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
const SLOW_QUERY_THRESHOLD_MS = 500;

function parseBoolean(value: string | null, defaultValue: boolean) {
  if (value == null) {
    return defaultValue;
  }

  return value.toLowerCase() !== "false";
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? String(DEFAULT_LIMIT), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const limit = parseLimit(searchParams.get("limit"));
    const activeOnly = parseBoolean(searchParams.get("activeOnly"), true);
    const requireActivePermit = parseBoolean(
      searchParams.get("requireActivePermit"),
      true,
    );

    if (search.length < MIN_QUERY_LENGTH) {
      const durationMs = Date.now() - startedAt;

      console.info("[vehicle-options] query", {
        durationMs,
        queryLength: search.length,
        limit,
        resultCount: 0,
        activeOnly,
        requireActivePermit,
      });

      return NextResponse.json({ vehicles: [] });
    }

    const now = new Date();
    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(requireActivePermit
        ? {
            permit: {
              is: {
                status: PermitStatus.ACTIVE,
                expiryDate: {
                  gt: now,
                },
              },
            },
          }
        : {}),
      OR: [
        { plateNumber: { contains: search, mode: "insensitive" as const } },
        { make: { contains: search, mode: "insensitive" as const } },
        { model: { contains: search, mode: "insensitive" as const } },
        { color: { contains: search, mode: "insensitive" as const } },
        { ownerName: { contains: search, mode: "insensitive" as const } },
        { driverName: { contains: search, mode: "insensitive" as const } },
        {
          permit: {
            is: {
              permitPlateNumber: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          },
        },
      ],
    };

    const vehicles = await prisma.vehicle.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plateNumber: true,
        vehicleType: true,
        make: true,
        model: true,
        color: true,
        ownerName: true,
        driverName: true,
        driverLicense: true,
        permit: {
          select: {
            permitPlateNumber: true,
          },
        },
      },
    });

    const durationMs = Date.now() - startedAt;
    const queryMeta = {
      durationMs,
      queryLength: search.length,
      limit,
      resultCount: vehicles.length,
      activeOnly,
      requireActivePermit,
    };

    console.info("[vehicle-options] query", queryMeta);

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      console.warn("[vehicle-options] slow-query", queryMeta);
    }

    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => serializeVehicleLookup(vehicle)),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    console.error("[vehicle-options] error", {
      durationMs,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to fetch vehicle options" },
      { status: 500 },
    );
  }
}
