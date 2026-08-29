'use client'

import AdminRoutingSettingsManager from '@/components/AdminRoutingSettingsManager'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function AdminRoutingSettingsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Routing Settings"
        subtitle="Control which routing provider the server uses first"
        backHref="/admin"
        width="narrow"
      >
        <AdminRoutingSettingsManager />
      </PageShell>
    </RoleGuard>
  )
}
