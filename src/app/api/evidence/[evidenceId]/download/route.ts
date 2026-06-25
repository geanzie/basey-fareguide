import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthErrorResponse, requireRequestUser } from "@/lib/auth";
import {
  canReadIncidentEvidence,
  INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE,
} from "@/lib/incidents/evidenceAuthorization";
import { ensureS3Configured, getS3Bucket, getS3Client, getSignedUrlTtl } from "@/lib/s3Client";

// This route uses Node.js native crypto and the AWS SDK — must not run on edge runtime.
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ evidenceId: string }> },
) {
  try {
    const user = await requireRequestUser(request);
    const { evidenceId } = await context.params;

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        fileUrl: true,
        storageStatus: true,
        incident: {
          select: {
            reportedById: true,
            handledById: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json({ message: "Evidence not found" }, { status: 404 });
    }

    if (!canReadIncidentEvidence(evidence.incident, user)) {
      return NextResponse.json(
        { message: INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE },
        { status: 403 },
      );
    }

    if (evidence.storageStatus === "DELETED") {
      return NextResponse.json(
        { message: "This evidence file has been removed from storage." },
        { status: 410 },
      );
    }

    if (!evidence.fileUrl) {
      return NextResponse.json(
        { message: "Evidence file location is missing." },
        { status: 404 },
      );
    }

    ensureS3Configured();

    const signedUrl = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: evidence.fileUrl,
      }),
      { expiresIn: getSignedUrlTtl() },
    );

    // Redirect the authenticated request to the short-lived presigned URL.
    // The presigned URL includes all auth info needed for MinIO — the browser
    // never receives S3 credentials, only this time-limited signed URL.
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}
