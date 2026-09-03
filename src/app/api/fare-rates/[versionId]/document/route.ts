import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { createAuthErrorResponse, requireRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureS3Configured, getS3Bucket, getS3Client, getSignedUrlTtl } from "@/lib/s3Client";

// This route uses Node.js streams and the AWS SDK — must not run on edge runtime.
export const runtime = "nodejs";

/**
 * Read the municipal issuance behind a fare rate version.
 *
 * Any signed-in user may read one: these are public records, and the About page
 * that lists them is itself behind an authenticated route. No role guard.
 *
 * Two response modes, and both are load-bearing:
 *
 *  - default — 302 to a short-lived presigned URL. The mobile app depends on
 *    this: `WebBrowser.openBrowserAsync` cannot carry an Authorization header,
 *    so the app fetches this route with its bearer token, follows the redirect,
 *    and opens the resulting anonymous URL. Same trick as evidence downloads.
 *
 *  - `?inline=1` — stream the bytes through this route. The web viewer needs it
 *    because pdf.js fetches the file over XHR, and a cross-origin redirect to
 *    the object store would require a CORS rule on the bucket. Serving
 *    same-origin sidesteps that entirely.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ versionId: string }> },
) {
  try {
    await requireRequestUser(request);
    const { versionId } = await context.params;

    const version = await prisma.fareRateVersion.findUnique({
      where: { id: versionId },
      select: {
        documentKey: true,
        documentMimeType: true,
        documentFileName: true,
      },
    });

    if (!version) {
      return NextResponse.json({ message: "Fare rate version not found." }, { status: 404 });
    }

    if (!version.documentKey) {
      return NextResponse.json(
        { message: "This fare rate version has no supporting document." },
        { status: 404 },
      );
    }

    ensureS3Configured();

    const command = new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: version.documentKey,
    });

    // Read from request.url rather than request.nextUrl: the latter only exists
    // on a NextRequest, and this handler is also driven directly from tests.
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    if (!inline) {
      const signedUrl = await getSignedUrl(getS3Client(), command, {
        expiresIn: getSignedUrlTtl(),
      });
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const object = await getS3Client().send(command);
    if (!object.Body) {
      return NextResponse.json(
        { message: "Supporting document is unavailable." },
        { status: 404 },
      );
    }

    const fileName = version.documentFileName ?? "supporting-document";

    return new NextResponse(object.Body.transformToWebStream(), {
      headers: {
        "Content-Type": version.documentMimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        // Private: the response is behind an auth check, so no shared cache may
        // hold it. Short TTL keeps a re-render of the viewer from re-fetching.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return createAuthErrorResponse(error);
  }
}
