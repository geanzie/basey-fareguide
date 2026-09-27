import { redirect } from 'next/navigation'

import { LOGIN_ROUTE } from '@/lib/authRoutes'

// `/auth` is the sign-in page; this path stays so old links and bookmarks still land there.
export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item)
    }
  }
  const query = params.toString()
  redirect(query ? `${LOGIN_ROUTE}?${query}` : LOGIN_ROUTE)
}
