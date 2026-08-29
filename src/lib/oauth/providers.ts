import { OAuthProvider } from '@prisma/client'

/** Profile fields we need from a provider, normalized across Google and Facebook. */
export interface OAuthProfile {
  providerAccountId: string
  email: string | null
  /** Whether the provider asserts the email address belongs to this person. */
  emailVerified: boolean
  firstName: string
  lastName: string
}

interface ProviderConfig {
  id: OAuthProvider
  label: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
  /** Extra query params appended to the authorize URL. */
  authorizeParams?: Record<string, string>
  clientId: () => string | undefined
  clientSecret: () => string | undefined
  fetchProfile: (tokens: TokenResponse) => Promise<OAuthProfile>
}

export interface TokenResponse {
  access_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
}

const PROVIDER_SLUGS: Record<string, OAuthProvider> = {
  google: OAuthProvider.GOOGLE,
  facebook: OAuthProvider.FACEBOOK,
}

/** Decodes a JWT payload without verifying the signature. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.')

  if (!payload) {
    throw new Error('Malformed ID token')
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

function splitName(fullName: string | undefined, fallback: string): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { firstName: fallback, lastName: fallback }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

const CONFIGS: Record<OAuthProvider, ProviderConfig> = {
  [OAuthProvider.GOOGLE]: {
    id: OAuthProvider.GOOGLE,
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    authorizeParams: { access_type: 'online', prompt: 'select_account' },
    clientId: () => process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    // The code exchange is a server-to-server HTTPS call authenticated with the
    // client secret, so the id_token in its response is trusted without a JWKS
    // signature check. (It would need verifying if it ever arrived from a client.)
    async fetchProfile(tokens) {
      if (!tokens.id_token) {
        throw new Error('Google token response had no id_token')
      }

      const claims = decodeJwtPayload(tokens.id_token)
      const email = typeof claims.email === 'string' ? claims.email : null
      const fallback = email ? email.split('@')[0] : 'User'
      const given = typeof claims.given_name === 'string' ? claims.given_name : ''
      const family = typeof claims.family_name === 'string' ? claims.family_name : ''
      const split = splitName(typeof claims.name === 'string' ? claims.name : undefined, fallback)

      return {
        providerAccountId: String(claims.sub),
        email,
        emailVerified: claims.email_verified === true || claims.email_verified === 'true',
        firstName: given || split.firstName,
        lastName: family || split.lastName,
      }
    },
  },
  [OAuthProvider.FACEBOOK]: {
    id: OAuthProvider.FACEBOOK,
    label: 'Facebook',
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scope: 'public_profile,email',
    clientId: () => process.env.FACEBOOK_OAUTH_CLIENT_ID,
    clientSecret: () => process.env.FACEBOOK_OAUTH_CLIENT_SECRET,
    async fetchProfile(tokens) {
      if (!tokens.access_token) {
        throw new Error('Facebook token response had no access_token')
      }

      const url = new URL('https://graph.facebook.com/v21.0/me')
      url.searchParams.set('fields', 'id,email,first_name,last_name,name')

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })

      if (!response.ok) {
        throw new Error(`Facebook profile request failed: ${response.status}`)
      }

      const profile = (await response.json()) as Record<string, unknown>
      const email = typeof profile.email === 'string' ? profile.email : null
      const fallback = email ? email.split('@')[0] : 'User'
      const split = splitName(typeof profile.name === 'string' ? profile.name : undefined, fallback)

      return {
        providerAccountId: String(profile.id),
        email,
        // Facebook exposes no email_verified claim; addresses it returns are
        // confirmed on their side, so a returned email counts as verified.
        emailVerified: Boolean(email),
        firstName: typeof profile.first_name === 'string' ? profile.first_name : split.firstName,
        lastName: typeof profile.last_name === 'string' ? profile.last_name : split.lastName,
      }
    },
  },
}

/** Maps a URL path segment to a provider, or null when the slug is unknown. */
export function resolveProviderSlug(slug: string): OAuthProvider | null {
  return PROVIDER_SLUGS[slug.toLowerCase()] ?? null
}

export function getProviderSlug(provider: OAuthProvider): string {
  return provider.toLowerCase()
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  return CONFIGS[provider]
}

/** A provider is only usable when both of its credentials are configured. */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const config = CONFIGS[provider]
  return Boolean(config.clientId() && config.clientSecret())
}

export function listConfiguredProviders(): Array<{ provider: OAuthProvider; slug: string; label: string }> {
  return Object.values(CONFIGS)
    .filter((config) => isProviderConfigured(config.id))
    .map((config) => ({ provider: config.id, slug: getProviderSlug(config.id), label: config.label }))
}

/**
 * Base URL used to build the provider redirect URI. Behind the Cloudflare
 * tunnel the request origin is not the public URL, so APP_BASE_URL wins.
 */
export function getAppBaseUrl(requestOrigin: string): string {
  const configured = process.env.APP_BASE_URL?.trim()
  return (configured || requestOrigin).replace(/\/$/, '')
}

export function buildRedirectUri(provider: OAuthProvider, requestOrigin: string): string {
  return `${getAppBaseUrl(requestOrigin)}/api/auth/oauth/${getProviderSlug(provider)}/callback`
}

export function buildAuthorizeUrl(options: {
  provider: OAuthProvider
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const config = CONFIGS[options.provider]
  const url = new URL(config.authorizeUrl)

  url.searchParams.set('client_id', config.clientId()!)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('state', options.state)
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  for (const [key, value] of Object.entries(config.authorizeParams ?? {})) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

/** Exchanges an authorization code for tokens, then normalizes the profile. */
export async function exchangeCodeForProfile(options: {
  provider: OAuthProvider
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<OAuthProfile> {
  const config = CONFIGS[options.provider]

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: config.clientId()!,
      client_secret: config.clientSecret()!,
      code_verifier: options.codeVerifier,
    }),
  })

  if (!response.ok) {
    throw new Error(`${config.label} token exchange failed: ${response.status}`)
  }

  const tokens = (await response.json()) as TokenResponse
  return config.fetchProfile(tokens)
}
