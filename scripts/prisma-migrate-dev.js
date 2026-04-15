const { spawnSync } = require('node:child_process')
const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const ALLOW_REMOTE_ENV_NAME = 'PRISMA_MIGRATE_DEV_ALLOW_REMOTE'

function normalizePgConnectionStringForNodePostgres(parsedUrl) {
  const sslmode = parsedUrl.searchParams.get('sslmode')

  if (!sslmode) {
    return
  }

  if (parsedUrl.searchParams.get('uselibpqcompat') === 'true') {
    return
  }

  if (sslmode === 'prefer' || sslmode === 'require' || sslmode === 'verify-ca') {
    parsedUrl.searchParams.set('sslmode', 'verify-full')
  }
}

function normalizeDatabaseUrl(rawUrl) {
  const parsedUrl = new URL(rawUrl)
  normalizePgConnectionStringForNodePostgres(parsedUrl)

  if (parsedUrl.hostname.includes('-pooler')) {
    parsedUrl.hostname = parsedUrl.hostname.replace('-pooler', '')
  }

  return parsedUrl.toString()
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not configured.`)
  }

  return value
}

function getSchemaName(parsedUrl) {
  return parsedUrl.searchParams.get('schema')?.trim() || 'public'
}

function isRemoteHostname(hostname) {
  return !LOCAL_DATABASE_HOSTS.has(hostname) && !hostname.endsWith('.local')
}

function printRemoteSafetyBlock(parsedDatabaseUrl) {
  const schemaName = getSchemaName(parsedDatabaseUrl)
  const target = `${parsedDatabaseUrl.hostname}/${parsedDatabaseUrl.pathname.replace(/^\//, '') || '(default database)'}?schema=${schemaName}`

  console.error(`[db:migrate:dev] Refusing to run Prisma migrate dev against remote database ${target}.`)
  console.error('[db:migrate:dev] This command can reset schemas when migration history drifts or an applied migration was edited.')
  console.error('[db:migrate:dev] Use a disposable local database by default, or a disposable remote branch only with explicit opt-in.')
  console.error('[db:migrate:dev] Live or shared databases must use npm run db:migrate:deploy instead.')
  console.error(
    `[db:migrate:dev] To intentionally use a disposable remote database, set ${ALLOW_REMOTE_ENV_NAME}=1 and configure SHADOW_DATABASE_URL first.`,
  )
}

function getPrismaCommand(prismaArgs) {
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
    args: [prismaEntrypoint, 'migrate', 'dev', ...prismaArgs],
  }
}

function main() {
  const prismaArgs = process.argv.slice(2)
  const normalizedDatabaseUrl = normalizeDatabaseUrl(getRequiredEnv('DATABASE_URL'))
  const parsedDatabaseUrl = new URL(normalizedDatabaseUrl)
  const isRemoteDatabase = isRemoteHostname(parsedDatabaseUrl.hostname)
  const allowRemoteDatabase = process.env[ALLOW_REMOTE_ENV_NAME] === '1'
  const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL?.trim()

  if (isRemoteDatabase && !allowRemoteDatabase) {
    printRemoteSafetyBlock(parsedDatabaseUrl)
    process.exit(1)
  }

  if (isRemoteDatabase && !shadowDatabaseUrl) {
    console.error('[db:migrate:dev] SHADOW_DATABASE_URL is required when running Prisma migrate dev against a remote database.')
    console.error('[db:migrate:dev] Point it at a disposable shadow database or branch, then rerun the command.')
    process.exit(1)
  }

  const prismaCommand = getPrismaCommand(prismaArgs)
  const env = {
    ...process.env,
    DATABASE_URL: normalizedDatabaseUrl,
  }

  if (shadowDatabaseUrl) {
    env.SHADOW_DATABASE_URL = normalizeDatabaseUrl(shadowDatabaseUrl)
  }

  console.log(
    `[db:migrate:dev] Running Prisma migrate dev against ${parsedDatabaseUrl.hostname} (${isRemoteDatabase ? 'remote opt-in' : 'local database'}).`,
  )

  const result = spawnSync(prismaCommand.command, prismaCommand.args, {
    stdio: 'inherit',
    env,
  })

  if (result.error) {
    throw result.error
  }

  process.exit(typeof result.status === 'number' ? result.status : 1)
}

main()