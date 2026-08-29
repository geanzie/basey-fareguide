'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminAnnouncementsManager from '@/components/AdminAnnouncementsManager'
import PageShell from '@/ui/PageShell'

export default function AdminAnnouncementsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Traffic Announcements"
        subtitle="Publish, schedule, update, and archive municipal advisories"
        backHref="/admin"
      >
        <AdminAnnouncementsManager />
      </PageShell>
    </RoleGuard>
  )
}
