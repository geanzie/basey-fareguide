import AuthPage from '@/components/auth/AuthPage'
import { resolveAuthErrorMessage } from '@/lib/oauth/errorMessages'
import { listConfiguredProviders } from '@/lib/oauth/providers'

interface AuthPageSearchParams {
  error?: string | string[]
  username?: string | string[]
}

function getSearchParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<AuthPageSearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const error = getSearchParamValue(resolvedSearchParams?.error)

  return (
    <AuthPage
      initialError={error ? resolveAuthErrorMessage(error) : ''}
      initialUsername={getSearchParamValue(resolvedSearchParams?.username)}
      socialProviders={listConfiguredProviders().map(({ slug, label }) => ({ slug, label }))}
    />
  )
}