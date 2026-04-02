const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const {
  backfillPlannerLocations,
} = require("../src/lib/locations/locationSeedData.js");

const prisma = new PrismaClient();

async function resolveSeedCreatorUserId() {
  if (process.env.LOCATION_SEED_USER_ID) {
    return process.env.LOCATION_SEED_USER_ID;
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      userType: "ADMIN",
      isActive: true,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (adminUser) {
    return adminUser.id;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (fallbackUser) {
    return fallbackUser.id;
  }

  throw new Error(
    "No active user found for location backfill. Set LOCATION_SEED_USER_ID to an existing user id before running `npm run db:seed`.",
  );
}

async function main() {
  const datasetPath = path.join(__dirname, "../src/data/basey-locations.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const creatorUserId = await resolveSeedCreatorUserId();
  const now = new Date();

  const result = await backfillPlannerLocations(prisma, {
    dataset,
    creatorUserId,
    now,
  });

  console.log(
    `Location backfill complete. Total: ${result.total}, created: ${result.created}, skipped existing: ${result.skipped}`,
  );
}

main()
  .catch((error) => {
    console.error("Location backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
