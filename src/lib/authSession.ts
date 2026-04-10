function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const AUTH_SESSION_MAX_AGE_SECONDS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_AUTH_SESSION_MAX_AGE_SECONDS,
  60 * 60 * 8,
)

export const AUTH_SESSION_IDLE_TIMEOUT_MS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_AUTH_IDLE_TIMEOUT_MS,
  60 * 60 * 2 * 1000,
)

export const AUTH_SESSION_REVALIDATION_MS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_AUTH_REVALIDATION_MS,
  60 * 1000,
)

export const AUTH_SESSION_BOOTSTRAP_TIMEOUT_MS = parsePositiveInteger(
  process.env.NEXT_PUBLIC_AUTH_BOOTSTRAP_TIMEOUT_MS,
  8000,
)

export const AUTH_SESSION_JWT_EXPIRES_IN = AUTH_SESSION_MAX_AGE_SECONDS
