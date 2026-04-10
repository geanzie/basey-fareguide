'use client'

import { useRouter } from 'next/navigation'

import AdminRoutingSettingsManager from '@/components/AdminRoutingSettingsManager'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function AdminRoutingSettingsPage() {
  const router = useRouter()

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Routing Settings"
        subtitle="Control which routing provider the server uses first for route calculations"
      >
        <div className="space-y-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Back to Admin Dashboard
          </button>

          <AdminRoutingSettingsManager />
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}