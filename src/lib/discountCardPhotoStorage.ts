import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crypto from "crypto";

import { ensureS3Configured, getS3Bucket, getS3Client } from "@/lib/s3Client";

/**
 * Storage for discount-card ID photos.
 *
 * These are government ID images, so they live in the same private bucket as
 * incident evidence and are never served from a public path. `photoUrl` on the
 * DiscountCard row holds the OBJECT KEY, exactly as `Evidence.fileUrl` does;
 * reading one goes through GET /api/discount-cards/[cardId]/photo, which checks
 * the caller and answers with a short-lived presigned URL.
 *
 * They used to be written to `public/uploads/discount-cards/`. On a serverless
 * host that directory is part of the immutable deployment, so every one of
 * those files was lost on the next deploy — see isLegacyLocalPhotoUrl below for
 * how the rows that point at them are handled.
 */

const S3_DISCOUNT_CARD_PREFIX = "discount-cards";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/**
 * True for a `photoUrl` written by the old filesystem implementation.
 *
 * The bytes behind these are gone. Callers surface that as a 410 rather than
 * asking S3 for a key that was never there.
 */
export function isLegacyLocalPhotoUrl(photoUrl: string): boolean {
  return photoUrl.startsWith("/uploads/");
}

export function getDiscountCardObjectKey(fileName: string): string {
  return `${S3_DISCOUNT_CARD_PREFIX}/${fileName}`;
}

/**
 * Validate an uploaded ID photo. Throws with a message safe to return to the
 * applicant.
 *
 * The extension comes from the MIME type rather than the submitted filename:
 * the filename is attacker-controlled and only the type is checked above.
 */
export function validateDiscountCardPhoto(file: File): string {
  if (!file.type.startsWith("image/")) {
    throw new Error("Photo must be an image file");
  }

  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Photo must be a JPEG, PNG, WebP, or HEIC image");
  }

  if (file.size > MAX_PHOTO_SIZE) {
    throw new Error("Photo file size must be less than 5MB");
  }

  return extensionByMimeType[file.type];
}

/**
 * Upload an ID photo to the private bucket.
 *
 * Takes the buffer the caller already read, because both routes validate the
 * image with `validateIDImage` before storing it and there is no reason to read
 * the file twice.
 *
 * Returns the object key to store in `DiscountCard.photoUrl`.
 */
export async function storeDiscountCardPhoto(options: {
  userId: string;
  file: File;
  buffer: Buffer;
}): Promise<string> {
  const { userId, file, buffer } = options;

  const fileExtension = validateDiscountCardPhoto(file);
  ensureS3Configured();

  const fileName = `${userId}_${crypto.randomUUID()}.${fileExtension}`.replace(/[\\/]/g, "");
  const objectKey = getDiscountCardObjectKey(fileName);

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
 * Delete a stored ID photo. Idempotent, and a no-op for legacy local paths.
 *
 * Used when a re-application replaces an earlier photo, so a rejected ID does
 * not linger in the bucket indefinitely.
 */
export async function removeDiscountCardPhoto(objectKey: string | null): Promise<void> {
  if (!objectKey || isLegacyLocalPhotoUrl(objectKey)) {
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
