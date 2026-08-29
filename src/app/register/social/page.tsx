import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import SocialSignupCompleteForm from '@/components/auth/SocialSignupCompleteForm'
import { LOGIN_ROUTE } from '@/lib/authRoutes'
import { getProviderConfig } from '@/lib/oauth/providers'
import { OAUTH_SIGNUP_COOKIE, parseSignupTicket } from '@/lib/oauth/state'

/**
 * Reads the signup ticket server-side: the cookie is httpOnly, so the form
 * receives the provider-supplied name and email as props.
 */
export default async function SocialRegisterPage() {
  const cookieStore = await cookies()
  const ticket = parseSignupTicket(cookieStore.get(OAUTH_SIGNUP_COOKIE)?.value)

  if (!ticket) {
    redirect(`${LOGIN_ROUTE}?error=oauth_ticket_expired`)
  }

  return (
    <SocialSignupCompleteForm
      providerLabel={getProviderConfig(ticket.provider).label}
      firstName={ticket.firstName}
      lastName={ticket.lastName}
      email={ticket.email}
    />
  )
}
