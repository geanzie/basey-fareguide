'use client'

import type { PermitDto } from '@/lib/contracts'

import { vehicleTypeLabel } from './permitStickerPrint'

interface PermitQrStickerProps {
  permit: PermitDto
  qrDataUrl: string | null | undefined
}

/**
 * The physical sticker pasted on the vehicle. Never render the raw token here —
 * the token is the QR payload and must not end up readable on paper.
 */
export default function PermitQrSticker({ permit, qrDataUrl }: PermitQrStickerProps) {
  return (
    <div className="permit-qr-sticker-card flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
      {qrDataUrl != null ? (
        <img
          src={qrDataUrl}
          alt={`QR for permit ${permit.permitPlateNumber}`}
          className="h-[140px] w-[140px] rounded-lg border border-slate-200 bg-white p-1"
        />
      ) : (
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 text-xs text-red-400">
          QR failed
        </div>
      )}

      <div className="text-center font-mono text-sm font-bold leading-tight text-slate-900">
        {permit.permitPlateNumber}
      </div>

      <div className="text-center text-xs leading-tight text-slate-600">{permit.driverFullName}</div>

      <div className="text-[10px] text-slate-400">{vehicleTypeLabel(permit.vehicleType as string)}</div>

      <div className="mt-auto text-center text-[10px] italic text-slate-400">
        Scan to verify fare payment
      </div>
    </div>
  )
}
