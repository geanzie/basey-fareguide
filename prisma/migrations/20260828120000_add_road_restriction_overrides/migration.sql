-- CreateEnum
CREATE TYPE "RoadRestrictionKind" AS ENUM ('IMPASSABLE', 'SEASONAL', 'GRADE_TOO_STEEP', 'SURFACE_UNSUITABLE', 'ONE_WAY_LOCAL');

-- CreateEnum
CREATE TYPE "RoadRestrictionGeometry" AS ENUM ('POLYGON', 'POINT', 'OSM_WAY');

-- CreateTable
CREATE TABLE "road_restriction_overrides" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RoadRestrictionKind" NOT NULL,
    "geometryType" "RoadRestrictionGeometry" NOT NULL,
    "geometry" JSONB NOT NULL,
    "appliesTo" "VehicleType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_restriction_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_restriction_override_audit" (
    "id" TEXT NOT NULL,
    "roadRestrictionOverrideId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous" JSONB,
    "next" JSONB,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "road_restriction_override_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "road_restriction_overrides_name_key" ON "road_restriction_overrides"("name");

-- CreateIndex
CREATE INDEX "road_restriction_overrides_isActive_idx" ON "road_restriction_overrides"("isActive");

-- CreateIndex
CREATE INDEX "road_restriction_overrides_isActive_effectiveFrom_effective_idx" ON "road_restriction_overrides"("isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "road_restriction_override_audit_roadRestrictionOverrideId_c_idx" ON "road_restriction_override_audit"("roadRestrictionOverrideId", "changedAt");

-- CreateIndex
CREATE INDEX "road_restriction_override_audit_changedAt_idx" ON "road_restriction_override_audit"("changedAt");

-- AddForeignKey
ALTER TABLE "road_restriction_overrides" ADD CONSTRAINT "road_restriction_overrides_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_restriction_overrides" ADD CONSTRAINT "road_restriction_overrides_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_restriction_override_audit" ADD CONSTRAINT "road_restriction_override_audit_roadRestrictionOverrideId_fkey" FOREIGN KEY ("roadRestrictionOverrideId") REFERENCES "road_restriction_overrides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_restriction_override_audit" ADD CONSTRAINT "road_restriction_override_audit_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

