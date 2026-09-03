import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crypto from "crypto";

import {
  FARE_DOCUMENT_EXTENSION_BY_MIME_TYPE,
  MAX_FARE_DOCUMENT_SIZE,
} from "@/lib/fare/documentTypes";
import { ensureS3Configured, getS3Bucket, getS3Client } from "@/lib/s3Client";

/**
 * Storage for the municipal issuance behind a fare rate change — the Sangguniang
 * Bayan resolution or ordinance that authorized the new rate.
 *
 * These live in the same private bucket as incident evidence and discount-card
 * photos. `FareRateVersion.documentKey` holds the OBJECT KEY, exactly as
 * `Evidence.fileUrl` and `DiscountCard.photoUrl` do; reading one goes through
 * GET /api/fare-rates/[versionId]/document, which checks the caller is signed in
 * and answers with a short-lived presigned URL.
 *
 * The bucket is private even though the documents are public records: the About
 * page that shows them is itself behind an authenticated route, and a presigned
 * URL keeps the bucket from being enumerable.
 */

const S3_FARE_DOCUMENT_PREFIX = "fare-documents";

export function getFareDocumentObjectKey(fileName: string): string {
  return `${S3_FARE_DOCUMENT_PREFIX}/${fileName}`;
}

/**
 * Validate an uploaded supporting document and return the extension to store it
 * under. Throws with a message safe to return to the admin.
 *
 * The extension comes from the MIME type rather than the submitted filename,
 * for the same reason as discount-card photos: the filename is caller-controlled
 * and only the type is checked here.
 */
export function validateFareDocument(file: File): string {
  const extension = FARE_DOCUMENT_EXTENSION_BY_MIME_TYPE[file.type];

  if (!extension) {
    throw new Error("Supporting document must be a PDF, JPEG, PNG, or WebP file");
  }

  if (file.size <= 0) {
    throw new Error("Supporting document file is empty");
  }

  if (file.size > MAX_FARE_DOCUMENT_SIZE) {
    throw new Error("Supporting document file size must be less than 15MB");
  }

  return extension;
}

/**
 * Upload a supporting document to the private bucket.
 *
 * Returns the object key to store in `FareRateVersion.documentKey`.
 */
export async function storeFareDocument(options: {
  versionId: string;
  file: File;
  buffer: Buffer;
}): Promise<string> {
  const { versionId, file, buffer } = options;

  const fileExtension = validateFareDocument(file);
  ensureS3Configured();

  const fileName = `${versionId}_${crypto.randomUUID()}.${fileExtension}`.replace(/[\\/]/g, "");
  const objectKey = getFareDocumentObjectKey(fileName);

  const upload = new Upload({
    client: getS3Client(),
    params: {
      Bucket: getS3Bucket(),
      Key: objectKey,
      Body: buffer,
      ContentType: file.type,
      // Object is private — no ACL set.
    },
  });

  await upload.done();

  return objectKey;
}

/**
 * Delete a stored document. Idempotent.
 *
 * Called after the row has been updated to point elsewhere, so a failed delete
 * leaves an orphaned object rather than a row pointing at bytes that are gone.
 */
export async function removeFareDocument(objectKey: string | null): Promise<void> {
  if (!objectKey) {
    return;
  }

  ensureS3Configured();
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: objectKey,
    }),
  );
}
