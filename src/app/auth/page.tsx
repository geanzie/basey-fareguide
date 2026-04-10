import AuthPage from '@/components/auth/AuthPage'

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

  return (
    <AuthPage
      initialError={getSearchParamValue(resolvedSearchParams?.error)}
      initialUsername={getSearchParamValue(resolvedSearchParams?.username)}
    />
  )
}