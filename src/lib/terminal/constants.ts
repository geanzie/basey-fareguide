function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const TERMINAL_UNLOCK_COOKIE_NAME = 'terminal-unlock'

export const TERMINAL_UNLOCK_MAX_AGE_SECONDS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_TERMINAL_UNLOCK_MAX_AGE_SECONDS,
  15 * 60,
)

export const TERMINAL_UNLOCK_IDLE_TIMEOUT_MS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_TERMINAL_UNLOCK_IDLE_TIMEOUT_MS,
  5 * 60 * 1000,
)