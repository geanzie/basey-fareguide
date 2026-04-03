'use client'

import { useAuth } from '@/components/AuthProvider'
import DiscountApplication from '@/components/DiscountApplication'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function DiscountApplicationPage() {
  const { user } = useAuth()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper
        title="Apply for Discount Card"
        subtitle="Submit your application for Senior Citizen, PWD, or Student discount"
      >
        {user ? <DiscountApplication user={user} /> : null}
      </PageWrapper>
    </RoleGuard>
  )
}
