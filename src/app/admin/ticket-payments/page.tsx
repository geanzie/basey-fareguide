'use client'

import RoleGuard from '@/components/RoleGuard'
import TicketPaymentsWorkspace from '@/components/TicketPaymentsWorkspace'
import PageShell from '@/ui/PageShell'

export default function AdminTicketPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="Ticket Payments"
        subtitle="Read-only oversight of encoder-recorded ticket settlements"
        backHref="/admin"
      >
        <TicketPaymentsWorkspace
          allowPaymentRecording={false}
          heading="Ticket Payment Oversight"
          description="Review ticket settlements, official receipt numbers, and recorded payment timestamps from the treasurer's office."
          defaultPaymentFilter="ALL"
        />
      </PageShell>
    </RoleGuard>
  )
}
