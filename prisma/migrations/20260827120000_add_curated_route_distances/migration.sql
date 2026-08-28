-- CreateEnum
CREATE TYPE "CuratedRouteSource" AS ENUM ('SURVEYED', 'ORDINANCE', 'ADOPTED_FROM_ENGINE', 'BATCH_SEEDED');

-- CreateTable
CREATE TABLE "curated_route_distances" (
    "id" TEXT NOT NULL,
    "originLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "polyline" TEXT,
    "isBidirectional" BOOLEAN NOT NULL DEFAULT false,
    "source" "CuratedRouteSource" NOT NULL,
    "needsSurvey" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "surveyedAt" TIMESTAMP(3) NOT NULL,
    "surveyedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curated_route_distances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curated_route_distance_audit" (
    "id" TEXT NOT NULL,
    "curatedRouteDistanceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous" JSONB,
    "next" JSONB,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "curated_route_distance_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curated_route_distances_originLocationId_destinationLocatio_idx" ON "curated_route_distances"("originLocationId", "destinationLocationId");

-- CreateIndex
CREATE INDEX "curated_route_distances_vehicleType_isActive_idx" ON "curated_route_distances"("vehicleType", "isActive");

-- CreateIndex
CREATE INDEX "curated_route_distances_needsSurvey_idx" ON "curated_route_distances"("needsSurvey");

-- CreateIndex
CREATE UNIQUE INDEX "curated_route_distances_originLocationId_destinationLocatio_key" ON "curated_route_distances"("originLocationId", "destinationLocationId", "vehicleType");

-- CreateIndex
CREATE INDEX "curated_route_distance_audit_curatedRouteDistanceId_changed_idx" ON "curated_route_distance_audit"("curatedRouteDistanceId", "changedAt");

-- CreateIndex
CREATE INDEX "curated_route_distance_audit_changedAt_idx" ON "curated_route_distance_audit"("changedAt");

-- AddForeignKey
ALTER TABLE "curated_route_distances" ADD CONSTRAINT "curated_route_distances_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_route_distances" ADD CONSTRAINT "curated_route_distances_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_route_distances" ADD CONSTRAINT "curated_route_distances_surveyedBy_fkey" FOREIGN KEY ("surveyedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_route_distance_audit" ADD CONSTRAINT "curated_route_distance_audit_curatedRouteDistanceId_fkey" FOREIGN KEY ("curatedRouteDistanceId") REFERENCES "curated_route_distances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_route_distance_audit" ADD CONSTRAINT "curated_route_distance_audit_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

