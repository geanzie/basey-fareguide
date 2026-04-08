import TicketPaymentsWorkspace from '@/components/TicketPaymentsWorkspace'

export default function EncoderTicketPayments() {
  return (
    <TicketPaymentsWorkspace
      allowPaymentRecording={true}
      heading="Ticket Payment Recording"
      description="Record ticket payments after the municipal treasurer's office issues the official receipt."
      defaultPaymentFilter="UNPAID"
    />
  )
}