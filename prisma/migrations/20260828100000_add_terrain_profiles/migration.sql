-- Terrain gating: per-vehicle grade limits, and a permanent cache of measured
-- elevation profiles.
--
-- Additive only. Nothing reads these until ROUTING_TERRAIN_ENABLED is set, and
-- even then enforceGradeGate defaults to false, so the gate observes and logs
-- rather than refusing quotes.

-- CreateTable
CREATE TABLE "vehicle_routing_profiles" (
    "vehicleType" "VehicleType" NOT NULL,
    "maxUpwardGradePercent" INTEGER NOT NULL,
    "minGradedSegmentMeters" INTEGER NOT NULL DEFAULT 25,
    "enforceGradeGate" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_routing_profiles_pkey" PRIMARY KEY ("vehicleType")
);

-- CreateTable
CREATE TABLE "route_terrain_profiles" (
    "id" TEXT NOT NULL,
    "polylineHash" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "sampleSpacingM" DECIMAL(8,2) NOT NULL,
    "demResolutionM" DECIMAL(8,2) NOT NULL,
    "smoothingWindowM" DECIMAL(8,2) NOT NULL,
    "elevationGainM" DECIMAL(8,2) NOT NULL,
    "elevationLossM" DECIMAL(8,2) NOT NULL,
    "maxGradePercent" DECIMAL(6,2) NOT NULL,
    "samples" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_terrain_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_terrain_profiles_polylineHash_key" ON "route_terrain_profiles"("polylineHash");

-- CreateIndex
CREATE INDEX "route_terrain_profiles_createdAt_idx" ON "route_terrain_profiles"("createdAt");

-- AddForeignKey
ALTER TABLE "vehicle_routing_profiles" ADD CONSTRAINT "vehicle_routing_profiles_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the grade limits, all with enforcement OFF.
--
-- These are engineering judgement, not ordinance figures, and the elevation
-- data available over Basey is far coarser than they were reasoned about
-- (~153 m on roads, ~611 m inland, against the ~30 m assumed). Measured on
-- 2026-08-28, four of six upland routes already read 12.7-15.9% — above the
-- tricycle limit below — on roads tricycles demonstrably serve. Enforcing these
-- as they stand would refuse real fares, which is exactly why the gate ships
-- observing only.
INSERT INTO "vehicle_routing_profiles"
    ("vehicleType", "maxUpwardGradePercent", "minGradedSegmentMeters", "enforceGradeGate", "updatedAt")
VALUES
    ('TRICYCLE',    12, 25, false, CURRENT_TIMESTAMP),
    ('HABAL_HABAL', 25, 25, false, CURRENT_TIMESTAMP),
    ('JEEPNEY',     15, 25, false, CURRENT_TIMESTAMP),
    ('MULTICAB',    15, 25, false, CURRENT_TIMESTAMP),
    ('VAN',         15, 25, false, CURRENT_TIMESTAMP),
    ('BUS',         15, 25, false, CURRENT_TIMESTAMP);
