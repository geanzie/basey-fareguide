'use client'

import AdminDriverSessionSettingsManager from '@/components/AdminDriverSessionSettingsManager'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function AdminDriverSessionSettingsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Driver Session Suspension"
        subtitle="Choose which vehicle types record trips by rider QR scan instead of driver acceptance"
        backHref="/admin"
        width="narrow"
      >
        <AdminDriverSessionSettingsManager />
      </PageShell>
    </RoleGuard>
  )
}
