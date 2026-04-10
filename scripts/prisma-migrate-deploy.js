const { spawnSync } = require('node:child_process')

function resolveMigrationDatabaseUrl() {
  const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim()
  if (directDatabaseUrl) {
    return {
      connectionString: directDatabaseUrl,
      source: 'DIRECT_DATABASE_URL',
      derived: false,
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const parsedUrl = new URL(databaseUrl)
  const originalHostname = parsedUrl.hostname

  if (originalHostname.includes('-pooler')) {
    parsedUrl.hostname = originalHostname.replace('-pooler', '')

    return {
      connectionString: parsedUrl.toString(),
      source: 'DATABASE_URL',
      derived: true,
    }
  }

  return {
    connectionString: databaseUrl,
    source: 'DATABASE_URL',
    derived: false,
  }
}

function getCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

function main() {
  const migrationUrl = resolveMigrationDatabaseUrl()
  const hostname = new URL(migrationUrl.connectionString).hostname

  console.log(
    `[db:migrate:deploy] Running Prisma migrations with ${migrationUrl.derived ? 'derived direct' : 'configured'} host ${hostname} from ${migrationUrl.source}.`,
  )

  if (process.env.PRISMA_MIGRATE_DEPLOY_SKIP_EXEC === '1') {
    console.log('[db:migrate:deploy] Skipping prisma migrate deploy because PRISMA_MIGRATE_DEPLOY_SKIP_EXEC=1.')
    return
  }

  const result = spawnSync(getCommand(), ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: migrationUrl.connectionString,
    },
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

main()