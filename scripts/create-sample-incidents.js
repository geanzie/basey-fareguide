import { PrismaClient, IncidentType, IncidentStatus } from '../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createSampleIncidents() {
  try {
    console.log('Creating sample incidents...')

    // Get a public user to be the reporter (or create one if needed)
    let publicUser = await prisma.user.findFirst({
      where: { userType: 'PUBLIC' }
    })

    if (!publicUser) {
      console.log('No public user found, creating a sample reporter...')
      const hashedPassword = await bcrypt.hash('reporter123', 12)
      
      publicUser = await prisma.user.create({
        data: {
          email: 'reporter@basey-fareguide.com',
          username: 'reporter1',
          password: hashedPassword,
          firstName: 'John',
          lastName: 'Reporter',
          phoneNumber: '+63-123-456-7890',
          userType: 'PUBLIC',
          isActive: true,
          isVerified: true,
          verifiedAt: new Date()
        }
      })
      console.log('Sample reporter created:', publicUser.email)
    }

    // Sample incidents data
    const sampleIncidents = [
      {
        incidentType: 'FARE_OVERCHARGE',
        description: 'Driver charged PHP 25 instead of the standard PHP 15 fare from Poblacion to Guintigui-an.',
        location: 'Poblacion to Guintigui-an Route',
        plateNumber: 'ABC-1234',
        driverLicense: 'N01-12-123456',
        incidentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        coordinates: '11.2757,124.9628'
      },
      {
        incidentType: 'RECKLESS_DRIVING',
        description: 'Tricycle driver was speeding and overtaking dangerously near the school zone.',
        location: 'Basey Elementary School Area',
        plateNumber: 'XYZ-5678',
        driverLicense: 'N01-15-789012',
        incidentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        coordinates: '11.2758,124.9630'
      },
      {
        incidentType: 'VEHICLE_VIOLATION',
        description: 'Jeepney operating without proper franchise papers and expired registration.',
        location: 'Basey Public Market',
        plateNumber: 'DEF-9012',
        driverLicense: 'N01-18-345678',
        incidentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        coordinates: '11.2760,124.9625'
      },
      {
        incidentType: 'ROUTE_VIOLATION',
        description: 'Multicab taking passengers outside designated route area.',
        location: 'Barangay Serum',
        plateNumber: 'GHI-3456',
        driverLicense: 'N01-20-901234',
        incidentDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        coordinates: '11.2755,124.9620'
      },
      {
        incidentType: 'FARE_UNDERCHARGE',
        description: 'Driver only charged PHP 8 instead of PHP 12 for the distance traveled.',
        location: 'Baloog to Mercado Route',
        plateNumber: 'JKL-7890',
        driverLicense: 'N01-22-567890',
        incidentDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        coordinates: '11.2762,124.9632'
      },
      {
        incidentType: 'OTHER',
        description: 'Driver refused to give change and was rude to elderly passenger.',
        location: 'San Antonio Terminal',
        plateNumber: 'MNO-2345',
        driverLicense: 'N01-25-123789',
        incidentDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        coordinates: '11.2759,124.9627'
      }
    ]

    // Create incidents
    for (const incidentData of sampleIncidents) {
      const existing = await prisma.incident.findFirst({
        where: { 
          plateNumber: incidentData.plateNumber,
          description: incidentData.description 
        }
      })

      if (!existing) {
        await prisma.incident.create({
          data: {
            ...incidentData,
            reportedById: publicUser.id,
            status: 'PENDING',
            evidenceUrls: []
          }
        })
        console.log(`✅ Created incident: ${incidentData.incidentType} - ${incidentData.plateNumber}`)
      } else {
        console.log(`⏭️ Incident already exists: ${incidentData.plateNumber}`)
      }
    }

    console.log('✅ Sample incidents creation completed!')
    console.log('\n🚔 To test the enforcer feature:')
    console.log('1. Login with: enforcer@basey-fareguide.com / enforcer123')
    console.log('2. Navigate to: http://localhost:3000/enforcer')
    console.log('3. You should see the incident queue with FIFO ordering')
    
  } catch (error) {
    console.error('Error creating sample incidents:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleIncidents()