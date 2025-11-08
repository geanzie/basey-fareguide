import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function testEnforcerIncidents() {
  try {
    console.log('=== Testing Enforcer Incidents API ===\n')

    // 1. Check if there are any incidents in the database
    const totalIncidents = await prisma.incident.count()
    console.log(`Total incidents in database: ${totalIncidents}`)

    if (totalIncidents === 0) {
      console.log('❌ No incidents found in database!')
      console.log('   Run: node scripts/create-sample-incidents.js to create test data\n')
      return
    }

    // 2. Get the most recent incidents
    const recentIncidents = await prisma.incident.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    console.log(`\nRecent incidents (${recentIncidents.length}):`)
    recentIncidents.forEach((incident, i) => {
      console.log(`\n${i + 1}. ${incident.incidentType}`)
      console.log(`   Status: ${incident.status}`)
      console.log(`   Location: ${incident.location}`)
      console.log(`   Plate: ${incident.plateNumber || 'N/A'}`)
      console.log(`   Reported by: ${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`)
      console.log(`   Created: ${incident.createdAt.toLocaleDateString()}`)
    })

    // 3. Check if there's an enforcer user
    const enforcers = await prisma.user.findMany({
      where: { userType: 'ENFORCER' }
    })

    console.log(`\n\nEnforcer accounts: ${enforcers.length}`)
    enforcers.forEach(enforcer => {
      console.log(`  - ${enforcer.username} (${enforcer.firstName} ${enforcer.lastName})`)
      console.log(`    Active: ${enforcer.isActive}`)
    })

    if (enforcers.length === 0) {
      console.log('❌ No enforcer accounts found!')
      console.log('   Create an enforcer account to test\n')
      return
    }

    // 4. Check incidents by status
    const statusCounts = await prisma.incident.groupBy({
      by: ['status'],
      _count: true
    })

    console.log('\n\nIncidents by status:')
    statusCounts.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count}`)
    })

    console.log('\n✅ Test complete!')
    console.log('\nIf incidents exist but don\'t show in the UI:')
    console.log('1. Check browser console for errors')
    console.log('2. Verify authentication token is valid')
    console.log('3. Check Network tab in DevTools for API response')

  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testEnforcerIncidents()
