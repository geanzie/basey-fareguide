'use client'

import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import EncoderTicketPayments from '@/components/EncoderTicketPayments'

export default function EncoderTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageWrapper
        title="Ticket Payments"
        subtitle="Record violation payments and official receipt notes from the treasurer's office"
      >
        <EncoderTicketPayments />
      </PageWrapper>
    </RoleGuard>
  )
}