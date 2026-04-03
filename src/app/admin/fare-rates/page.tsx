'use client'

import { useRouter } from 'next/navigation'

import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import AdminFareRatesManager from '@/components/AdminFareRatesManager'

export default function AdminFareRatesPage() {
  const router = useRouter()

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Fare Rates"
        subtitle="Publish live fare changes or schedule the next approved rate"
      >
        <div className="space-y-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Back to Admin Dashboard
          </button>

          <AdminFareRatesManager />
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}
