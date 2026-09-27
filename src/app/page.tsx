import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import LandingPage from '@/components/landing/LandingPage'
import { resolveAuthUserFromToken } from '@/lib/auth'
import { getAuthenticatedHomeRoute } from '@/lib/authRoutes'
import type { FareRatesResponseDto } from '@/lib/contracts'
import { getResolvedFareRates } from '@/lib/fare/rateService'

export const metadata: Metadata = {
  title: 'Basey FareCheck | Official fares under Municipal Ordinance No. 105',
  description:
    'The fare guide for tricycles and habal-habal in Basey, Samar: the fare in force today and what Municipal Ordinance No. 105, Series of 2023 requires.',
}

/**
 * Signed-in users go straight to their role home; everyone else gets the
 * public landing page. The session is resolved here on the server so a
 * signed-in user never sees the landing page flash first.
 */
export default async function HomePage() {
  const cookieStore = await cookies()
  const user = await resolveAuthUserFromToken(cookieStore.get('auth-token')?.value)

  if (user) {
    redirect(getAuthenticatedHomeRoute(user.userType))
  }

  // No fallback figure: if the rate cannot be read, the page says so rather
  // than showing a fare nobody approved.
  let fareRates: FareRatesResponseDto | null = null
  try {
    fareRates = await getResolvedFareRates()
  } catch (error) {
    console.error('[landing] failed to resolve fare rates', error)
  }

  return <LandingPage fareRates={fareRates} />
}
