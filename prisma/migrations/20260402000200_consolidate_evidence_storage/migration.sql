CREATE TYPE "EvidenceStorageStatus" AS ENUM ('AVAILABLE', 'DELETED');

ALTER TABLE "evidence"
ADD COLUMN "storageStatus" "EvidenceStorageStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "fileDeletedAt" TIMESTAMP(3);

ALTER TABLE "incidents" DROP COLUMN "evidenceUrls";
