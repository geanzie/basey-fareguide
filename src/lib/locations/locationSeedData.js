function flattenSeedLocations(dataset) {
  const categories = [
    ["barangay", "BARANGAY"],
    ["landmark", "LANDMARK"],
    ["sitio", "SITIO"],
  ];

  return categories.flatMap(([category, type]) =>
    (dataset.locations?.[category] || []).map((location) => ({
      name: location.name,
      type,
      coordinates: `${location.coordinates.lat},${location.coordinates.lng}`,
      barangay: type === "BARANGAY" ? location.name : null,
      description: location.address || null,
      googleFormattedAddress: location.address || null,
      sourceCategory: category,
    })),
  );
}

async function backfillPlannerLocations(
  prisma,
  { dataset, creatorUserId, now = new Date() },
) {
  const entries = flattenSeedLocations(dataset);
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const existing = await prisma.location.findUnique({
      where: { name: entry.name },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.location.create({
      data: {
        name: entry.name,
        type: entry.type,
        coordinates: entry.coordinates,
        barangay: entry.barangay,
        description: entry.description,
        isActive: true,
        createdBy: creatorUserId,
        verifiedBy: creatorUserId,
        verifiedAt: now,
        googleFormattedAddress: entry.googleFormattedAddress,
        lastValidated: now,
        validationStatus: "VALIDATED",
        isWithinMunicipality: true,
        isWithinBarangay: entry.type === "BARANGAY",
        actualBarangay: entry.barangay,
        validationLogs: {
          create: {
            validatedBy: creatorUserId,
            validationType: "SEED_BACKFILL",
            isValid: true,
            validationErrors: [],
            validationWarnings: [],
            withinMunicipality: true,
            withinBarangay: entry.type === "BARANGAY",
            detectedBarangay: entry.barangay,
            googleMapsValid: true,
            googleAddress: entry.googleFormattedAddress,
            googleConfidence: "high",
            validatedCoordinates: entry.coordinates,
            validatedAt: now,
          },
        },
      },
    });

    created += 1;
  }

  return {
    total: entries.length,
    created,
    skipped,
  };
}

module.exports = {
  backfillPlannerLocations,
  flattenSeedLocations,
};
