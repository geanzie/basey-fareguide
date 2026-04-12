'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface PermitQrCardProps {
  permitPlateNumber: string
  qrToken: string
  driverFullName: string
}

export default function PermitQrCard({
  permitPlateNumber,
  qrToken,
  driverFullName,
}: PermitQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    void QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8,
      width: 240,
    }).then((dataUrl: string) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl)
      }
    }).catch(() => {
      if (!cancelled) {
        setQrDataUrl('')
      }
    })

    return () => {
      cancelled = true
    }
  }, [qrToken])

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[auto,1fr] sm:items-start">
      <div className="flex justify-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for permit ${permitPlateNumber}`}
            className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
            Generating QR...
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Permit QR</div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{permitPlateNumber}</h4>
          <p className="text-sm text-slate-600">Assigned driver: {driverFullName}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stored Token</div>
          <div className="mt-2 break-all font-mono text-sm text-slate-900">{qrToken}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Print QR
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(qrToken).catch(() => {})}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Copy Token
          </button>
        </div>
      </div>
    </div>
  )
}