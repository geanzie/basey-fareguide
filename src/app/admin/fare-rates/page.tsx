'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminFareRatesManager from '@/components/AdminFareRatesManager'
import PageShell from '@/ui/PageShell'

export default function AdminFareRatesPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Fare Rates"
        subtitle="Publish live fare changes or schedule the next approved rate"
        backHref="/admin"
      >
        <AdminFareRatesManager />
      </PageShell>
    </RoleGuard>
  )
}
