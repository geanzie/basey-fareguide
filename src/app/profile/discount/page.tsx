'use client'

import { useAuth } from '@/components/AuthProvider'
import DiscountApplication from '@/components/DiscountApplication'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function DiscountApplicationPage() {
  const { user } = useAuth()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageShell
        title="Apply for Discount Card"
        subtitle="Senior Citizen, PWD, or Student discount"
        backHref="/profile"
        width="narrow"
      >
        {user ? <DiscountApplication user={user} /> : null}
      </PageShell>
    </RoleGuard>
  )
}
