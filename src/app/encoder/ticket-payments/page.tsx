'use client'

import RoleGuard from '@/components/RoleGuard'
import EncoderTicketPayments from '@/components/EncoderTicketPayments'
import GradientHeader from '@/ui/GradientHeader'

export default function EncoderTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Ticket Payments"
          subtitle="Record violation payments and official receipt notes"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <EncoderTicketPayments />
        </div>
      </div>
    </RoleGuard>
  )
}
