'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminFareRatesManager from '@/components/AdminFareRatesManager'
import GradientHeader from '@/ui/GradientHeader'

export default function AdminFareRatesPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Fare Rates"
          subtitle="Publish live fare changes or schedule the next approved rate"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <AdminFareRatesManager />
        </div>
      </div>
    </RoleGuard>
  )
}
