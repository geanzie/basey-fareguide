CREATE TYPE "AnnouncementCategory" AS ENUM (
    'EMERGENCY_NOTICE',
    'ROAD_CLOSURE',
    'ROAD_WORK',
    'TRAFFIC_ADVISORY'
);

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_archivedAt_startsAt_createdAt_idx"
ON "announcements"("archivedAt", "startsAt", "createdAt");

CREATE INDEX "announcements_archivedAt_endsAt_idx"
ON "announcements"("archivedAt", "endsAt");

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_archivedBy_fkey"
FOREIGN KEY ("archivedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
