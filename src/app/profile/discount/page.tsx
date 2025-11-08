'use client'

import { useAuth } from '@/components/AuthProvider'
import DiscountApplication from '@/components/DiscountApplication'
import PageWrapper from '@/components/PageWrapper'
import { useRouter } from 'next/navigation'

export default function DiscountApplicationPage() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) {
    return (
      <PageWrapper
        title="Discount Application"
        subtitle="Please log in to apply for a discount card"
      >
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600 mb-4">
              Please log in to apply for a discount card
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Log In
            </button>
          </div>
        </div>
      </PageWrapper>
    )
  }

  // Only PUBLIC users can apply for discount
  if (user.userType !== 'PUBLIC') {
    return (
      <PageWrapper
        title="Discount Application"
        subtitle="Access Restricted"
      >
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Not Available
            </h2>
            <p className="text-gray-600">
              Discount cards are only available for public users
            </p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="Apply for Discount Card"
      subtitle="Submit your application for Senior Citizen, PWD, or Student discount"
    >
      <DiscountApplication user={user} />
    </PageWrapper>
  )
}
