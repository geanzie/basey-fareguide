import { NextRequest, NextResponse } from "next/server";

import { createAuthErrorResponse, requireRequestUser } from "@/lib/auth";
import type { FareRateDocumentsResponseDto } from "@/lib/contracts";
import { FARE_BASE_DISTANCE_KM } from "@/lib/fare/policy";
import {
  getDocumentedFareRateVersions,
  isFareRateStorageMissingError,
} from "@/lib/fare/rateService";
import { serializeFareRateDocumentEntry } from "@/lib/serializers";

/**
 * Every fare rate change backed by a municipal issuance, newest first.
 *
 * Signed-in users only — this is the data behind the About page's document list,
 * which lives at an authenticated route. Note the `private` cache header: unlike
 * GET /api/fare-rates, this response is per-caller-authenticated and must never
 * land in a shared cache.
 *
 * A missing table answers with an empty list rather than a 503: the About page
 * has plenty else to show, and an unmigrated database is already surfaced by the
 * admin screen's warning.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestUser(request);

    const now = new Date();
    const versions = await getDocumentedFareRateVersions();

    const documents = versions
      .map((version) =>
        serializeFareRateDocumentEntry(version, {
          baseDistanceKm: FARE_BASE_DISTANCE_KM,
          now,
        }),
      )
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const response: FareRateDocumentsResponseDto = { documents };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
      const empty: FareRateDocumentsResponseDto = { documents: [] };
      return NextResponse.json(empty);
    }

    return createAuthErrorResponse(error);
  }
}
