UPDATE "incidents"
SET "paymentStatus" = CASE
  WHEN "paidAt" IS NOT NULL OR "officialReceiptNumber" IS NOT NULL THEN 'PAID'::"TicketPaymentStatus"
  ELSE 'UNPAID'::"TicketPaymentStatus"
END
WHERE "ticketNumber" IS NOT NULL
  AND "paymentStatus" = 'NOT_APPLICABLE'::"TicketPaymentStatus";