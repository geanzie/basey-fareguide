'use client'

import AdminFeedbackManager from '@/components/AdminFeedbackManager'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function AdminFeedbackPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="User Feedback"
        subtitle="What riders and staff are telling us about the system"
        backHref="/admin"
      >
        <AdminFeedbackManager />
      </PageShell>
    </RoleGuard>
  )
}
