import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from "@/lib/auth";
import { FARE_BASE_DISTANCE_KM } from "@/lib/fare/policy";
import {
  FARE_RATE_MIGRATION_REQUIRED_MESSAGE,
  getFareRateVersionById,
  invalidateResolvedFareRatesCache,
  isFareRateStorageMissingError,
} from "@/lib/fare/rateService";
import { removeFareDocument, storeFareDocument } from "@/lib/fareDocumentStorage";
import { prisma } from "@/lib/prisma";
import { serializeFareRateVersion } from "@/lib/serializers";

// The AWS SDK and node:crypto cannot run on the edge runtime.
export const runtime = "nodejs";

/**
 * Attach, replace, or remove the municipal issuance behind a fare rate version.
 *
 * This is deliberately a separate endpoint from POST /api/admin/fare-rates
 * rather than a multipart body on it:
 *
 *  - the JSON contract of the publish endpoint stays intact, so the mobile
 *    client's `createFareRate` keeps working untouched;
 *  - a document can be attached to a version published long ago, which is the
 *    only way past changes and the seeded legacy baseline row ever get paper;
 *  - a failed upload never rolls back a fare change that is already live.
 */

const EMPTY_DOCUMENT_FIELDS = {
  documentKey: null,
  documentTitle: null,
  documentReference: null,
  documentMimeType: null,
  documentFileName: null,
  documentSize: null,
  documentUploadedAt: null,
  documentUploadedBy: null,
} as const;

function serialize(version: Parameters<typeof serializeFareRateVersion>[0], now: Date) {
  return serializeFareRateVersion(version, {
    baseDistanceKm: FARE_BASE_DISTANCE_KM,
    now,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY]);
    const { id } = await context.params;
    const now = new Date();

    const version = await getFareRateVersionById(id);
    if (!version) {
      return NextResponse.json({ message: "Fare rate version not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("document");
    const title = typeof formData.get("title") === "string" ? String(formData.get("title")).trim() : "";
    const referenceValue = formData.get("reference");
    const reference =
      typeof referenceValue === "string" && referenceValue.trim() ? referenceValue.trim() : null;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { message: "A supporting document file is required." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { message: "A document title is required." },
        { status: 400 },
      );
    }

    let objectKey: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      objectKey = await storeFareDocument({ versionId: id, file, buffer });
    } catch (storageError) {
      const message =
        storageError instanceof Error
          ? storageError.message
          : "Supporting document could not be stored.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const previousKey = version.documentKey;

    const updated = await prisma.fareRateVersion.update({
      where: { id },
      data: {
        documentKey: objectKey,
        documentTitle: title,
        documentReference: reference,
        documentMimeType: file.type,
        documentFileName: file.name,
        documentSize: file.size,
        documentUploadedAt: now,
        documentUploadedBy: adminUser.id,
      },
      include: {
        createdByUser: { select: { firstName: true, lastName: true, username: true } },
        canceledByUser: { select: { firstName: true, lastName: true, username: true } },
        documentUploadedByUser: { select: { firstName: true, lastName: true, username: true } },
      },
    });

    // Only after the row points at the new object. A failed delete here leaves an
    // orphan in the bucket, which is recoverable; the reverse order would leave a
    // row pointing at bytes that are gone.
    if (previousKey && previousKey !== objectKey) {
      try {
        await removeFareDocument(previousKey);
      } catch (cleanupError) {
        console.error(
          "[/api/admin/fare-rates/[id]/document] failed to delete replaced document",
          cleanupError,
        );
      }
    }

    invalidateResolvedFareRatesCache();

    return NextResponse.json({
      success: true,
      fareRateVersion: serialize(updated, now),
      message: previousKey
        ? "Supporting document replaced successfully."
        : "Supporting document attached successfully.",
    });
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
      return NextResponse.json({ message: FARE_RATE_MIGRATION_REQUIRED_MESSAGE }, { status: 503 });
    }

    return createAuthErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY]);
    const { id } = await context.params;
    const now = new Date();

    const version = await getFareRateVersionById(id);
    if (!version) {
      return NextResponse.json({ message: "Fare rate version not found." }, { status: 404 });
    }

    if (!version.documentKey) {
      return NextResponse.json(
        { message: "This fare rate version has no supporting document." },
        { status: 404 },
      );
    }

    const previousKey = version.documentKey;

    const updated = await prisma.fareRateVersion.update({
      where: { id },
      data: { ...EMPTY_DOCUMENT_FIELDS },
      include: {
        createdByUser: { select: { firstName: true, lastName: true, username: true } },
        canceledByUser: { select: { firstName: true, lastName: true, username: true } },
        documentUploadedByUser: { select: { firstName: true, lastName: true, username: true } },
      },
    });

    try {
      await removeFareDocument(previousKey);
    } catch (cleanupError) {
      console.error(
        "[/api/admin/fare-rates/[id]/document] failed to delete document object",
        cleanupError,
      );
    }

    invalidateResolvedFareRatesCache();

    return NextResponse.json({
      success: true,
      fareRateVersion: serialize(updated, now),
      message: "Supporting document removed successfully.",
    });
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
      return NextResponse.json({ message: FARE_RATE_MIGRATION_REQUIRED_MESSAGE }, { status: 503 });
    }

    return createAuthErrorResponse(error);
  }
}
