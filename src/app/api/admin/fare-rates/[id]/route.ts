import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import {
  FARE_RATE_MIGRATION_REQUIRED_MESSAGE,
  getFareRateVersionById,
  invalidateResolvedFareRatesCache,
  isCurrentLiveFareRateVersion,
  isDeletableFareRateVersion,
  isFareRateStorageMissingError,
} from "@/lib/fare/rateService";
import { prisma } from "@/lib/prisma";

const FARE_VERSION_DELETED_ACTION = "fare_version_deleted";

function coerceReason(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));
    const reason = coerceReason(body.reason);
    const { id } = await context.params;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const version = await getFareRateVersionById(id, tx);
      if (!version) {
        return { status: "missing" as const };
      }

      if (isCurrentLiveFareRateVersion(version, now)) {
        return { status: "active" as const };
      }

      if (!isDeletableFareRateVersion(version, now)) {
        return { status: "blocked" as const };
      }

      await tx.fareRateDeletionAudit.create({
        data: {
          fareRateVersionId: version.id,
          action: FARE_VERSION_DELETED_ACTION,
          reason,
          deletedBy: adminUser.id,
        },
      });

      await tx.fareRateVersion.delete({
        where: { id: version.id },
      });

      return {
        status: "ok" as const,
        versionId: version.id,
      };
    });

    if (result.status === "missing") {
      return NextResponse.json(
        { error: "Fare rate version not found." },
        { status: 404 },
      );
    }

    if (result.status === "active") {
      return NextResponse.json(
        { error: "The current live fare rate cannot be deleted." },
        { status: 409 },
      );
    }

    if (result.status === "blocked") {
      return NextResponse.json(
        { error: "Only upcoming or historical fare rate versions can be deleted." },
        { status: 409 },
      );
    }

    invalidateResolvedFareRatesCache();

    return NextResponse.json({
      success: true,
      deletedVersionId: result.versionId,
      message: "Fare rate version deleted permanently.",
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