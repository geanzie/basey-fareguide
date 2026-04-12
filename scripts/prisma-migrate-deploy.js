const { spawnSync } = require('node:child_process')
const path = require('node:path')

const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_INITIAL_RETRY_DELAY_MS = 5000
const PG_SSLMODE_VERIFY_FULL_ALIASES = new Set(['prefer', 'require', 'verify-ca'])

function normalizePgConnectionStringForNodePostgres(parsedUrl) {
  const sslmode = parsedUrl.searchParams.get('sslmode')

  if (!sslmode) {
    return
  }

  if (parsedUrl.searchParams.get('uselibpqcompat') === 'true') {
    return
  }

  if (PG_SSLMODE_VERIFY_FULL_ALIASES.has(sslmode)) {
    parsedUrl.searchParams.set('sslmode', 'verify-full')
  }
}

function normalizeDatabaseUrl(rawUrl, source) {
  const parsedUrl = new URL(rawUrl)
  normalizePgConnectionStringForNodePostgres(parsedUrl)
  const originalHostname = parsedUrl.hostname

  if (originalHostname.includes('-pooler')) {
    parsedUrl.hostname = originalHostname.replace('-pooler', '')

    return {
      connectionString: parsedUrl.toString(),
      source,
      derived: true,
    }
  }

  return {
    connectionString: parsedUrl.toString(),
    source,
    derived: false,
  }
}

function resolveMigrationDatabaseUrl() {
  const directDatabaseUrl = process.env.DIRECT_DATABASE_URL?.trim()
  if (directDatabaseUrl) {
    return normalizeDatabaseUrl(directDatabaseUrl, 'DIRECT_DATABASE_URL')
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return normalizeDatabaseUrl(databaseUrl, 'DATABASE_URL')
}

function getPrismaCommand() {
  const prismaEntrypoint = path.join(
    __dirname,
    '..',
    'node_modules',
    'prisma',
    'build',
    'index.js',
  )

  return {
    command: process.execPath,
    args: [prismaEntrypoint, 'migrate', 'deploy'],
  }
}

function getMaxAttempts() {
  const rawValue = Number.parseInt(process.env.PRISMA_MIGRATE_DEPLOY_MAX_ATTEMPTS ?? '', 10)

  if (Number.isFinite(rawValue) && rawValue > 0) {
    return rawValue
  }

  return DEFAULT_MAX_ATTEMPTS
}

function getInitialRetryDelayMs() {
  const rawValue = Number.parseInt(process.env.PRISMA_MIGRATE_DEPLOY_RETRY_DELAY_MS ?? '', 10)

  if (Number.isFinite(rawValue) && rawValue >= 0) {
    return rawValue
  }

  return DEFAULT_INITIAL_RETRY_DELAY_MS
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetryableAdvisoryLockFailure(output) {
  const normalized = output.toLowerCase()

  return (
    normalized.includes('p1002') &&
    (normalized.includes('advisory lock') || normalized.includes('pg_advisory_lock'))
  )
}

function runPrismaMigrateDeploy(databaseUrl, attemptNumber, maxAttempts) {
  console.log(`[db:migrate:deploy] Attempt ${attemptNumber}/${maxAttempts}.`)

  const prismaCommand = getPrismaCommand()

  const result = spawnSync(prismaCommand.command, prismaCommand.args, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }

  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  return result
}

async function main() {
  const migrationUrl = resolveMigrationDatabaseUrl()
  const hostname = new URL(migrationUrl.connectionString).hostname
  const maxAttempts = getMaxAttempts()
  const initialRetryDelayMs = getInitialRetryDelayMs()

  console.log(
    `[db:migrate:deploy] Running Prisma migrations with ${migrationUrl.derived ? 'derived direct' : 'configured'} host ${hostname} from ${migrationUrl.source}.`,
  )

  if (process.env.PRISMA_MIGRATE_DEPLOY_SKIP_EXEC === '1') {
    console.log('[db:migrate:deploy] Skipping prisma migrate deploy because PRISMA_MIGRATE_DEPLOY_SKIP_EXEC=1.')
    return
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runPrismaMigrateDeploy(migrationUrl.connectionString, attempt, maxAttempts)

    if (result.error) {
      throw result.error
    }

    if (result.status === 0) {
      return
    }

    const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const retryable = isRetryableAdvisoryLockFailure(combinedOutput)
    const hasAttemptsRemaining = attempt < maxAttempts

    if (!retryable || !hasAttemptsRemaining) {
      process.exit(typeof result.status === 'number' ? result.status : 1)
    }

    const retryDelayMs = initialRetryDelayMs * 2 ** (attempt - 1)
    console.warn(
      `[db:migrate:deploy] Advisory lock is busy. Waiting ${retryDelayMs}ms before retrying Prisma migrations.`,
    )
    await sleep(retryDelayMs)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})