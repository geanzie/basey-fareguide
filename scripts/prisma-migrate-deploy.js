const { spawnSync } = require('node:child_process')

const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_INITIAL_RETRY_DELAY_MS = 5000

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

  const result = spawnSync(getCommand(), ['prisma', 'migrate', 'deploy'], {
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