import { NextResponse } from "next/server";

import { serializeCuratedRouteCorpus } from "@/lib/serializers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/curated-routes
 *
 * The whole active curated distance corpus, for clients that need to price a
 * trip with the radio off. Public and unauthenticated, matching /api/locations
 * and POST /api/routes/calculate — a distance between two published barangays
 * is not privileged data, and gating it would only stop the offline case from
 * working on a fresh install.
 *
 * These are the same numbers an online quote returns: resolveRouteForQuote
 * consults the curated corpus before any routing engine, so a client that
 * answers from this payload agrees with the server exactly rather than
 * estimating. That is the whole point — under Ordinance 105 a fare that
 * disagrees with the driver's app is a dispute, so an offline client shows
 * either this number or none at all.
 */
export async function GET() {
  try {
    const records = await prisma.curatedRouteDistance.findMany({
      where: { isActive: true },
      select: {
        originLocationId: true,
        destinationLocationId: true,
        vehicleType: true,
        distanceMeters: true,
        durationSeconds: true,
        isBidirectional: true,
        updatedAt: true,
      },
      // Stable order so the payload is byte-identical between requests that see
      // the same rows, which keeps the ETag and any downstream cache honest.
      orderBy: [{ originLocationId: "asc" }, { destinationLocationId: "asc" }, { vehicleType: "asc" }],
    });

    return NextResponse.json(serializeCuratedRouteCorpus(records), {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[/api/curated-routes] failed to load curated corpus", error);
    return NextResponse.json(
      { message: "Failed to load curated routes" },
      { status: 500 },
    );
  }
}
