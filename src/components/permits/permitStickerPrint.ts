import type { PermitDto } from '@/lib/contracts'

/**
 * One sticker geometry, shared by the bulk sheet and the single-permit print.
 * Both paths render the same card at the same size so a reprint drops into a
 * sheet printed months earlier without a visible seam.
 */
export const PRINT_SHEET_ID = 'permit-qr-print-sheet'

export const QR_DATA_URL_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  scale: 6,
  width: 180,
}

export const PRINT_STYLES = `
@page {
  margin: 8mm;
  size: A4 portrait;
}
@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body * {
    visibility: hidden !important;
  }
  #${PRINT_SHEET_ID} {
    visibility: visible !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  #${PRINT_SHEET_ID} * {
    visibility: visible !important;
  }
  .permit-qr-controls {
    display: none !important;
    visibility: hidden !important;
  }
  .permit-qr-print-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 48mm) !important;
    gap: 3mm !important;
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
  }
  .permit-qr-sticker-card {
    width: 48mm !important;
    min-height: 58mm !important;
    box-sizing: border-box !important;
    break-inside: avoid !important;
    -webkit-column-break-inside: avoid !important;
    page-break-inside: avoid !important;
    border: 0.5pt solid #cbd5e1 !important;
    border-radius: 2mm !important;
    padding: 3mm !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 1.5mm !important;
    background: white !important;
  }
  .permit-qr-sticker-card img {
    width: 36mm !important;
    height: 36mm !important;
  }
}
`

export function vehicleTypeLabel(raw: string): string {
  const slug = raw.replace(/_/g, '-').toLowerCase()
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export interface BulkQrResponse {
  permits: PermitDto[]
  total: number
  truncated: boolean
  scope?: 'unprinted' | 'all'
}
