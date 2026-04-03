'use client'

import { useRouter } from 'next/navigation'

import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import AdminAnnouncementsManager from '@/components/AdminAnnouncementsManager'

export default function AdminAnnouncementsPage() {
  const router = useRouter()

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Traffic Announcements"
        subtitle="Publish, schedule, update, and archive municipal advisories"
      >
        <div className="space-y-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Back to Admin Dashboard
          </button>

          <AdminAnnouncementsManager />
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}
