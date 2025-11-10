/**
 * Script to seed locations from barangay data into the database
 * Run with: node scripts/seed-locations.js
 */

const { PrismaClient } = require('../src/generated/prisma');
const baseyLocationsData = require('../src/data/basey-locations.json');

const prisma = new PrismaClient();

async function seedLocations() {
  console.log('Starting location seeding...\n');

  try {
    // Get or create admin user for seeding
    let adminUser = await prisma.user.findFirst({
      where: { userType: 'ADMIN' }
    });

    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`Using admin user: ${adminUser.username} (${adminUser.id})\n`);

    // Load comprehensive location data from basey-locations.json
    const { locations: locationData } = baseyLocationsData;

    // Process barangays
    const barangayLocations = (locationData.barangay || []).map(loc => ({
      name: loc.name,
      type: 'BARANGAY',
      coordinates: `${loc.coordinates.lat},${loc.coordinates.lng}`,
      barangay: loc.name,
      description: `Barangay ${loc.name}, verified from ${loc.source}`,
      source: loc.source,
      verified: loc.verified
    }));

    // Process landmarks
    const landmarkLocations = (locationData.landmark || []).map(loc => ({
      name: loc.name,
      type: 'LANDMARK',
      coordinates: `${loc.coordinates.lat},${loc.coordinates.lng}`,
      barangay: loc.address?.includes('Basey') ? 'Basey' : null,
      description: loc.type ? `${loc.type} - ${loc.address}` : loc.address,
      source: loc.source,
      verified: loc.verified
    }));

    // Process sitios
    const sitioLocations = (locationData.sitio || []).map(loc => ({
      name: loc.name,
      type: 'RURAL',
      coordinates: `${loc.coordinates.lat},${loc.coordinates.lng}`,
      barangay: loc.type || null,
      description: `Sitio ${loc.name} - ${loc.address}`,
      source: loc.source,
      verified: loc.verified
    }));

    // Combine all locations
    const allLocations = [...barangayLocations, ...landmarkLocations, ...sitioLocations];

    console.log(`Found ${barangayLocations.length} barangays to seed`);
    console.log(`Found ${landmarkLocations.length} landmarks to seed`);
    console.log(`Found ${sitioLocations.length} sitios to seed`);
    console.log(`Total: ${allLocations.length} locations from ${baseyLocationsData.metadata.sources.join(', ')}\n`);

    // Seed each location
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const location of allLocations) {
      try {
        // Check if location already exists
        const existing = await prisma.location.findUnique({
          where: { name: location.name }
        });

        if (existing) {
          // Update if coordinates are different
          if (existing.coordinates !== location.coordinates) {
            await prisma.location.update({
              where: { id: existing.id },
              data: {
                coordinates: location.coordinates,
                updatedAt: new Date()
              }
            });
            console.log(`✓ Updated: ${location.name}`);
            updated++;
          } else {
            console.log(`- Skipped: ${location.name} (already exists)`);
            skipped++;
          }
        } else {
          // Create new location (will work after migration is run)
          await prisma.location.create({
            data: {
              name: location.name,
              type: location.type,
              coordinates: location.coordinates,
              barangay: location.barangay,
              description: location.description,
              isActive: true
            }
          });
          console.log(`✓ Created: ${location.name}`);
          created++;
        }
      } catch (error) {
        console.error(`✗ Error processing ${location.name}:`, error.message);
      }
    }

    console.log('\n========== Seeding Summary ==========');
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total Processed: ${allLocations.length}`);
    console.log(`  - Barangays: ${barangayLocations.length}`);
    console.log(`  - Landmarks: ${landmarkLocations.length}`);
    console.log(`  - Sitios: ${sitioLocations.length}`);
    console.log(`\nData Sources: ${baseyLocationsData.metadata.sources.join(', ')}`);
    console.log(`Last Updated: ${baseyLocationsData.metadata.last_updated}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('Error seeding locations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedLocations()
  .then(() => {
    console.log('Location seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Location seeding failed:', error);
    process.exit(1);
  });
