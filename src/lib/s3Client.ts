import { S3Client } from "@aws-sdk/client-s3";

let s3ClientInstance: S3Client | null = null;

/**
 * Returns a singleton S3Client configured from environment variables.
 *
 * Required env vars (never NEXT_PUBLIC_*):
 *   S3_ENDPOINT          — MinIO API URL, e.g. http://farecheck_minio:9000
 *   S3_REGION            — region string, e.g. us-east-1 (MinIO ignores this but SDK requires it)
 *   S3_ACCESS_KEY_ID     — MinIO access key
 *   S3_SECRET_ACCESS_KEY — MinIO secret key
 *   S3_FORCE_PATH_STYLE  — must be "true" for MinIO path-style addressing (default: true)
 */
export function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  // Short-circuit in tests — callers mock the SDK directly.
  if (process.env.NODE_ENV === "test") {
    s3ClientInstance = new S3Client({});
    return s3ClientInstance;
  }

  ensureS3Configured();

  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

  s3ClientInstance = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle,
  });

  return s3ClientInstance;
}

/**
 * Returns the evidence S3 bucket name from env.
 * Falls back to "incident-evidence" if not set.
 */
export function getS3Bucket(): string {
  return process.env.S3_BUCKET ?? "incident-evidence";
}

/**
 * Returns the presigned URL TTL in seconds from env.
 * Falls back to 300 seconds (5 minutes).
 */
export function getSignedUrlTtl(): number {
  const raw = Number.parseInt(process.env.S3_SIGNED_URL_TTL_SECONDS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 300;
}

/**
 * Throws if required S3 env vars are missing.
 * Call before any S3 operation outside of test mode.
 */
export function ensureS3Configured(): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const missing: string[] = [];
  if (!process.env.S3_ENDPOINT) missing.push("S3_ENDPOINT");
  if (!process.env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
  if (!process.env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Evidence storage is not configured. Missing environment variables: ${missing.join(", ")}. ` +
        "Set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY to connect to MinIO.",
    );
  }
}
