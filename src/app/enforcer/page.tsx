'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerControlCenter from '@/components/enforcer-operations/EnforcerControlCenter'

// The incident list lives on /enforcer/incidents (open queue + closed history);
// this page is the overview only.
export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <EnforcerControlCenter
        title="Incident Operations"
        subtitle="Live picture of reported violations across Basey"
      />
    </RoleGuard>
  )
}
