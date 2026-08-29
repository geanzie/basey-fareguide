'use client'

/** Providers the server found credentials for; empty means nothing renders. */
export interface SocialProviderOption {
  slug: string
  label: string
}

interface Props {
  providers: SocialProviderOption[]
  /** Wording differs between the sign-in and register tabs. */
  action?: 'signin' | 'signup'
}

const GoogleIcon = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="h-5 w-5">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.93v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.93a9 9 0 0 0 0 8.1l3.04-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .93 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c-3.01 0-4.79 1.83-4.79 4.72v2.32h2.8V24C19.61 23.1 24 18.1 24 12.07Z"
    />
  </svg>
)

const ICONS: Record<string, () => React.ReactElement> = {
  google: GoogleIcon,
  facebook: FacebookIcon,
}

/**
 * Links (not fetches) to the OAuth start route: the browser has to follow the
 * redirect to the provider as a top-level navigation.
 */
const SocialSignInButtons = ({ providers, action = 'signin' }: Props) => {
  if (providers.length === 0) {
    return null
  }

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-3">
        {providers.map((provider) => {
          const Icon = ICONS[provider.slug]

          return (
            <a
              key={provider.slug}
              href={`/api/auth/oauth/${provider.slug}/start`}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3 text-base font-bold text-ink-body transition-colors hover:bg-surface-alt"
            >
              {Icon ? <Icon /> : null}
              Continue with {provider.label}
            </a>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-ink-muted">
        {action === 'signup'
          ? 'Fastest way to register — we only ask for a few more details.'
          : 'No password to remember.'}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-surface-border" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">or</span>
        <span className="h-px flex-1 bg-surface-border" />
      </div>
    </div>
  )
}

export default SocialSignInButtons
