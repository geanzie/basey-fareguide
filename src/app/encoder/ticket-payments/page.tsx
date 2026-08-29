'use client'

import RoleGuard from '@/components/RoleGuard'
import EncoderTicketPayments from '@/components/EncoderTicketPayments'
import PageShell from '@/ui/PageShell'

export default function EncoderTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageShell
        title="Ticket Payments"
        subtitle="Record violation payments and official receipt notes"
      >
        <EncoderTicketPayments />
      </PageShell>
    </RoleGuard>
  )
}
