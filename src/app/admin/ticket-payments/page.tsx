'use client'

import RoleGuard from '@/components/RoleGuard'
import PageWrapper from '@/components/PageWrapper'
import TicketPaymentsWorkspace from '@/components/TicketPaymentsWorkspace'

export default function AdminTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Ticket Payments"
        subtitle="Read-only oversight of encoder-recorded ticket settlements and official receipts"
      >
        <TicketPaymentsWorkspace
          allowPaymentRecording={false}
          heading="Ticket Payment Oversight"
          description="Review ticket settlements, official receipt numbers, and recorded payment timestamps from the treasurer's office."
          defaultPaymentFilter="ALL"
        />
      </PageWrapper>
    </RoleGuard>
  )
}