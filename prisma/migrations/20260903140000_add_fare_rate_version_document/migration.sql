-- Supporting municipal issuance (SB resolution / ordinance) behind a fare rate change.
-- "documentKey" holds the S3 object key, matching Evidence.fileUrl and DiscountCard.photoUrl.
ALTER TABLE "fare_rate_versions"
ADD COLUMN "documentKey" TEXT,
ADD COLUMN "documentTitle" TEXT,
ADD COLUMN "documentReference" TEXT,
ADD COLUMN "documentMimeType" TEXT,
ADD COLUMN "documentFileName" TEXT,
ADD COLUMN "documentSize" INTEGER,
ADD COLUMN "documentUploadedAt" TIMESTAMP(3),
ADD COLUMN "documentUploadedBy" TEXT;

ALTER TABLE "fare_rate_versions"
ADD CONSTRAINT "fare_rate_versions_documentUploadedBy_fkey"
FOREIGN KEY ("documentUploadedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
