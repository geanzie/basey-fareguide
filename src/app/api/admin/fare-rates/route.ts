import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import {
  FARE_RATE_MIGRATION_REQUIRED_MESSAGE,
  getAdminFareRates,
  invalidateResolvedFareRatesCache,
} from "@/lib/fare/rateService";
import { FARE_BASE_DISTANCE_KM } from "@/lib/fare/policy";
import { parseManilaDateTimeInput } from "@/lib/manilaTime";
import { serializeFareRateVersion } from "@/lib/serializers";

function coercePositiveNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function isFareRateTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("fare_rate_versions") ||
    message.includes("farerateversion")
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const response = await getAdminFareRates();
    return NextResponse.json(response);
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json();

    const baseFare = coercePositiveNumber(body.baseFare);
    const perKmRate = coercePositiveNumber(body.perKmRate);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const mode = body.mode === "scheduled" ? "scheduled" : "immediate";

    if (baseFare == null || perKmRate == null) {
      return NextResponse.json(
        { error: "Base fare and per-kilometer fare must be positive numbers." },
        { status: 400 },
      );
    }

    if (!notes) {
      return NextResponse.json(
        { error: "An admin note is required for fare changes." },
        { status: 400 },
      );
    }

    const now = new Date();
    let effectiveAt = now;

    if (mode === "scheduled") {
      if (typeof body.effectiveAt !== "string") {
        return NextResponse.json(
          { error: "A scheduled fare change requires an effective date and time." },
          { status: 400 },
        );
      }

      const parsedEffectiveAt = parseManilaDateTimeInput(body.effectiveAt);
      if (!parsedEffectiveAt) {
        return NextResponse.json(
          { error: "Invalid effective date and time." },
          { status: 400 },
        );
      }

      if (parsedEffectiveAt <= now) {
        return NextResponse.json(
          { error: "Scheduled fare changes must be set in the future." },
          { status: 400 },
        );
      }

      effectiveAt = parsedEffectiveAt;
    }

    const { createdVersion, replacedVersionId } = await prisma.$transaction(async (tx) => {
      let futureVersionId: string | null = null;

      if (mode === "scheduled") {
        const existingFutureVersion = await tx.fareRateVersion.findFirst({
          where: {
            canceledAt: null,
            effectiveAt: {
              gt: now,
            },
          },
          orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });

        if (existingFutureVersion) {
          futureVersionId = existingFutureVersion.id;
          await tx.fareRateVersion.update({
            where: { id: existingFutureVersion.id },
            data: {
              canceledAt: now,
              canceledBy: adminUser.id,
              cancellationReason: "Replaced by a newly scheduled fare rate version.",
            },
          });
        }
      }

      const newVersion = await tx.fareRateVersion.create({
        data: {
          baseFare,
          perKmRate,
          effectiveAt,
          createdBy: adminUser.id,
          notes,
        },
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          canceledByUser: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      return {
        createdVersion: newVersion,
        replacedVersionId: futureVersionId,
      };
    });

    invalidateResolvedFareRatesCache();

    return NextResponse.json(
      {
        success: true,
        fareRateVersion: serializeFareRateVersion(createdVersion, {
          baseDistanceKm: FARE_BASE_DISTANCE_KM,
          now,
        }),
        replacedVersionId,
        message:
          mode === "scheduled"
            ? "Scheduled fare rate saved successfully."
            : "Fare rate published successfully.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isFareRateTableMissingError(error)) {
      return NextResponse.json(
        { message: FARE_RATE_MIGRATION_REQUIRED_MESSAGE },
        { status: 503 },
      );
    }

    return createAuthErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Canceled by administrator.";
    const now = new Date();

    const scheduledVersion = await prisma.fareRateVersion.findFirst({
      where: {
        canceledAt: null,
        effectiveAt: {
          gt: now,
        },
      },
      orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (!scheduledVersion) {
      return NextResponse.json(
        { error: "No upcoming fare rate is scheduled." },
        { status: 404 },
      );
    }

    await prisma.fareRateVersion.update({
      where: { id: scheduledVersion.id },
      data: {
        canceledAt: now,
        canceledBy: adminUser.id,
        cancellationReason: reason,
      },
    });

    invalidateResolvedFareRatesCache();

    return NextResponse.json({
      success: true,
      canceledVersionId: scheduledVersion.id,
      message: "Scheduled fare rate canceled successfully.",
    });
  } catch (error) {
    if (isFareRateTableMissingError(error)) {
      return NextResponse.json(
        { message: FARE_RATE_MIGRATION_REQUIRED_MESSAGE },
        { status: 503 },
      );
    }

    return createAuthErrorResponse(error);
  }
}
