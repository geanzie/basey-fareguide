import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { FARE_BASE_DISTANCE_KM } from "@/lib/fare/policy";
import {
  FARE_RATE_MIGRATION_REQUIRED_MESSAGE,
  getCurrentLiveFareRateVersion,
  getPreviousEligibleFareRateVersion,
  invalidateResolvedFareRatesCache,
  isFareRateStorageMissingError,
} from "@/lib/fare/rateService";
import { prisma } from "@/lib/prisma";
import { serializeFareRateVersion } from "@/lib/serializers";

function coerceReason(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));
    const reason = coerceReason(body.reason);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const currentVersion = await getCurrentLiveFareRateVersion(tx, now);
      if (!currentVersion) {
        return { status: "missing-current" as const };
      }

      const previousVersion = await getPreviousEligibleFareRateVersion(currentVersion, tx);
      if (!previousVersion) {
        return { status: "missing-previous" as const };
      }

      await tx.fareRateVersion.update({
        where: { id: currentVersion.id },
        data: {
          canceledAt: now,
          canceledBy: adminUser.id,
          cancellationReason: reason
            ? `Reverted by administrator. Reason: ${reason}`
            : "Reverted by administrator.",
        },
      });

      return {
        status: "ok" as const,
        currentVersion,
        previousVersion,
      };
    });

    if (result.status === "missing-current") {
      return NextResponse.json(
        { error: "No live fare rate is available to revert." },
        { status: 404 },
      );
    }

    if (result.status === "missing-previous") {
      return NextResponse.json(
        { error: "No previous eligible fare rate is available for rollback." },
        { status: 409 },
      );
    }

    invalidateResolvedFareRatesCache();

    return NextResponse.json({
      success: true,
      revertedFromVersionId: result.currentVersion.id,
      fareRateVersion: serializeFareRateVersion(result.previousVersion, {
        baseDistanceKm: FARE_BASE_DISTANCE_KM,
        now,
      }),
      message: "Fare rate reverted to the previous eligible version.",
    });
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
      return NextResponse.json(
        { message: FARE_RATE_MIGRATION_REQUIRED_MESSAGE },
        { status: 503 },
      );
    }

    return createAuthErrorResponse(error);
  }
}