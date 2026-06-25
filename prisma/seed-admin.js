const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is not set. Run with e.g. SEED_ADMIN_PASSWORD=... node prisma/seed-admin.js',
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: { password: hash },
    create: {
      username,
      password: hash,
      firstName: 'System',
      lastName: 'Admin',
      userType: 'ADMIN',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('Admin seeded:', user.id, user.username);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
