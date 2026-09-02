'use client'

import RoleGuard from '@/components/RoleGuard'
import SendFeedbackForm from '@/components/SendFeedbackForm'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'
import PageShell from '@/ui/PageShell'

export default function ProfileFeedbackPage() {
  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <PageShell
        title="Send Feedback"
        subtitle="Tell us what works and what does not"
        width="narrow"
        backHref="/profile"
      >
        <SendFeedbackForm />
      </PageShell>
    </RoleGuard>
  )
}
