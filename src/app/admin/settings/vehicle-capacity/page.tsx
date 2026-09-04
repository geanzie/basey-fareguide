'use client'

import AdminVehicleCapacitySettingsManager from '@/components/AdminVehicleCapacitySettingsManager'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function AdminVehicleCapacitySettingsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Vehicle Seat Capacity"
        subtitle="Set how many passengers each vehicle type may carry, and how many seats a charter buys"
        backHref="/admin"
        width="narrow"
      >
        <AdminVehicleCapacitySettingsManager />
      </PageShell>
    </RoleGuard>
  )
}
