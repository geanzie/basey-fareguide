'use client'

import { useAuth } from '@/components/AuthProvider'
import DiscountApplication from '@/components/DiscountApplication'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'

export default function DiscountApplicationPage() {
  const { user } = useAuth()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="Apply for Discount Card"
          subtitle="Senior Citizen, PWD, or Student discount"
          backHref="/profile"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          {user ? <DiscountApplication user={user} /> : null}
        </div>
      </div>
    </RoleGuard>
  )
}
