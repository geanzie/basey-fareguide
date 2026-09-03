import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { UserType } from "@prisma/client";

import { createAuthErrorResponse, requireRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLegacyLocalPhotoUrl } from "@/lib/discountCardPhotoStorage";
import { ensureS3Configured, getS3Bucket, getS3Client, getSignedUrlTtl } from "@/lib/s3Client";

// Uses the AWS SDK and native crypto to presign — must not run on edge runtime.
export const runtime = "nodejs";

/**
 * GET /api/discount-cards/[cardId]/photo
 *
 * Redirects to a short-lived presigned URL for the applicant's ID photo.
 *
 * These are government IDs held in a private bucket, so the only readers are an
 * admin reviewing the application and the applicant themselves. The browser
 * never sees storage credentials — only a URL that expires
 * (S3_SIGNED_URL_TTL_SECONDS, default 300s).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ cardId: string }> },
) {
  try {
    const user = await requireRequestUser(request);
    const { cardId } = await context.params;

    const card = await prisma.discountCard.findUnique({
      where: { id: cardId },
      select: { id: true, userId: true, photoUrl: true },
    });

    if (!card) {
      return NextResponse.json({ message: "Discount card not found" }, { status: 404 });
    }

    const isOwner = card.userId === user.id;
    const isAdmin = user.userType === UserType.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { message: "You do not have access to this ID photo." },
        { status: 403 },
      );
    }

    if (!card.photoUrl) {
      return NextResponse.json({ message: "No ID photo on this application." }, { status: 404 });
    }

    // Applications submitted before photos moved to object storage point at a
    // path under public/uploads that the deployment no longer contains. Say so
    // plainly instead of presigning a key that does not exist.
    if (isLegacyLocalPhotoUrl(card.photoUrl)) {
      return NextResponse.json(
        {
          message:
            "This ID photo was stored before photos moved to secure storage and is no longer available. Ask the applicant to re-upload it.",
          code: "PHOTO_UNAVAILABLE_LEGACY",
        },
        { status: 410 },
      );
    }

    ensureS3Configured();

    const signedUrl = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: card.photoUrl,
      }),
      { expiresIn: getSignedUrlTtl() },
    );

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}
