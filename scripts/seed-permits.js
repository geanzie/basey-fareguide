import { PrismaClient, VehicleType, PermitStatus } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function seedPermits() {
  try {
    console.log('Seeding permit data...')

    // Sample permit data
    const permits = [
      {
        permitPlateNumber: 'PERMIT-2025-001',
        driverFullName: 'Juan Dela Cruz',
        vehicleType: VehicleType.TRICYCLE,
        expiryDate: new Date('2025-12-31'),
        status: PermitStatus.ACTIVE,
        encodedBy: 'system'
      },
      {
        permitPlateNumber: 'PERMIT-2024-002',
        driverFullName: 'Maria Santos',
        vehicleType: VehicleType.HABAL_HABAL,
        expiryDate: new Date('2024-12-31'), // Expired
        status: PermitStatus.EXPIRED,
        encodedBy: 'system'
      },
      {
        permitPlateNumber: 'PERMIT-2025-003',
        driverFullName: 'Pedro Rodriguez',
        vehicleType: VehicleType.TRICYCLE,
        expiryDate: new Date('2025-11-15'), // Expiring soon
        status: PermitStatus.ACTIVE,
        encodedBy: 'system'
      },
      {
        permitPlateNumber: 'PERMIT-2025-004',
        driverFullName: 'Ana Garcia',
        vehicleType: VehicleType.HABAL_HABAL,
        expiryDate: new Date('2025-06-30'),
        status: PermitStatus.SUSPENDED,
        encodedBy: 'system'
      },
      {
        permitPlateNumber: 'PERMIT-2025-005',
        driverFullName: 'Carlos Mendoza',
        vehicleType: VehicleType.TRICYCLE,
        expiryDate: new Date('2025-09-15'),
        status: PermitStatus.ACTIVE,
        encodedBy: 'system'
      },
      {
        plateNumber: 'PQR-678',
        driverFullName: 'Rosa Fernandez',
        vehicleType: VehicleType.HABAL_HABAL,
        expiryDate: new Date('2025-03-20'),
        status: PermitStatus.REVOKED,
        encodedBy: 'system'
      },
      {
        plateNumber: 'STU-901',
        driverFullName: 'Miguel Torres',
        vehicleType: VehicleType.TRICYCLE,
        expiryDate: new Date('2025-10-30'), // Expiring soon
        status: PermitStatus.ACTIVE,
        encodedBy: 'system'
      },
      {
        plateNumber: 'VWX-234',
        driverFullName: 'Carmen Lopez',
        vehicleType: VehicleType.HABAL_HABAL,
        expiryDate: new Date('2026-01-15'),
        status: PermitStatus.ACTIVE,
        encodedBy: 'system'
      }
    ]

    for (const permit of permits) {
      const existingPermit = await prisma.permit.findUnique({
        where: { plateNumber: permit.plateNumber }
      })

      if (!existingPermit) {
        await prisma.permit.create({
          data: permit
        })
        console.log(`Created permit: ${permit.plateNumber} - ${permit.driverFullName}`)
      } else {
        console.log(`Permit already exists: ${permit.plateNumber}`)
      }
    }

    console.log('Permit seeding completed!')
  } catch (error) {
    console.error('Error seeding permits:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedPermits()