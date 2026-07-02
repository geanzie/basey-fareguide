'use client'

import AdminRoutingSettingsManager from '@/components/AdminRoutingSettingsManager'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'

export default function AdminRoutingSettingsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="Routing Settings"
          subtitle="Control which routing provider the server uses first"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <AdminRoutingSettingsManager />
        </div>
      </div>
    </RoleGuard>
  )
}
