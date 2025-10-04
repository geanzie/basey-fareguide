import { PrismaClient, UserType } from '../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createInitialAdmin() {
  try {
    console.log('Creating initial admin user...')

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { userType: UserType.ADMIN }
    })

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email)
      return
    }

    // Admin user details
    const adminData = {
      email: 'admin@basey-fareguide.com',
      username: 'admin',
      password: 'admin123', // Change this password immediately after first login
      firstName: 'System',
      lastName: 'Administrator',
      phoneNumber: '+63-XXX-XXX-XXXX',
      userType: UserType.ADMIN
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminData.password, 12)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        ...adminData,
        password: hashedPassword,
        isActive: true,
        isVerified: true,
        verifiedAt: new Date()
      }
    })

    console.log('✅ Admin user created successfully!')
    console.log('Email:', adminData.email)
    console.log('Password:', adminData.password)
    console.log('⚠️  IMPORTANT: Change the default password after first login!')

    // Create some sample encoder and enforcer users
    const sampleUsers = [
      {
        email: 'encoder@basey-fareguide.com',
        username: 'encoder1',
        password: 'encoder123',
        firstName: 'Data',
        lastName: 'Encoder',
        phoneNumber: '+63-XXX-XXX-XXXX',
        userType: UserType.DATA_ENCODER
      },
      {
        email: 'enforcer@basey-fareguide.com',
        username: 'enforcer1',
        password: 'enforcer123',
        firstName: 'Traffic',
        lastName: 'Enforcer',
        phoneNumber: '+63-XXX-XXX-XXXX',
        userType: UserType.ENFORCER
      }
    ]

    for (const userData of sampleUsers) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (!existingUser) {
        const hashedUserPassword = await bcrypt.hash(userData.password, 12)
        
        await prisma.user.create({
          data: {
            ...userData,
            password: hashedUserPassword,
            isActive: true,
            isVerified: true,
            verifiedAt: new Date()
          }
        })

        console.log(`✅ ${userData.userType} user created:`)
        console.log('Email:', userData.email)
        console.log('Password:', userData.password)
      } else {
        console.log(`${userData.userType} user already exists:`, userData.email)
      }
    }

    console.log('\n🎉 Initial users setup completed!')
    console.log('\nYou can now login with any of the above credentials.')
    console.log('Remember to change the default passwords!')

  } catch (error) {
    console.error('❌ Error creating initial users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createInitialAdmin()