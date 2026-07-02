'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminAnnouncementsManager from '@/components/AdminAnnouncementsManager'
import GradientHeader from '@/ui/GradientHeader'

export default function AdminAnnouncementsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Traffic Announcements"
          subtitle="Publish, schedule, update, and archive municipal advisories"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <AdminAnnouncementsManager />
        </div>
      </div>
    </RoleGuard>
  )
}
