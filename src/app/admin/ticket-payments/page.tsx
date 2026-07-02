'use client'

import RoleGuard from '@/components/RoleGuard'
import TicketPaymentsWorkspace from '@/components/TicketPaymentsWorkspace'
import GradientHeader from '@/ui/GradientHeader'

export default function AdminTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Ticket Payments"
          subtitle="Read-only oversight of encoder-recorded ticket settlements"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <TicketPaymentsWorkspace
            allowPaymentRecording={false}
            heading="Ticket Payment Oversight"
            description="Review ticket settlements, official receipt numbers, and recorded payment timestamps from the treasurer's office."
            defaultPaymentFilter="ALL"
          />
        </div>
      </div>
    </RoleGuard>
  )
}
