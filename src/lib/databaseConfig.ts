export const DEFAULT_PG_CONNECTION_TIMEOUT_MS = 5000

const PG_SSLMODE_VERIFY_FULL_ALIASES = new Set(['prefer', 'require', 'verify-ca'])

export function getPgConnectionTimeoutMs(envValue = process.env.PG_CONNECTION_TIMEOUT_MS): number {
  if (!envValue) {
    return DEFAULT_PG_CONNECTION_TIMEOUT_MS
  }

  const parsedValue = Number.parseInt(envValue, 10)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_PG_CONNECTION_TIMEOUT_MS
  }

  return parsedValue
}

export function normalizePgConnectionUrlForNodePostgres(parsedUrl: URL): void {
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