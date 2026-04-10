export const DEFAULT_PG_CONNECTION_TIMEOUT_MS = 5000

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