'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface PermitQrCardProps {
  permitPlateNumber: string
  qrToken: string
  driverFullName: string
  /**
   * Reveal the raw token behind a toggle. Encoder-only: the token is the QR
   * payload, so it is a bearer secret and never belongs on a printed sticker.
   */
  showToken?: boolean
  /**
   * When provided, renders a "Print sticker" action. The parent owns the print
   * sheet so the single-permit print uses the same A4 sticker layout as bulk.
   */
  onPrintSticker?: () => void
}

export default function PermitQrCard({
  permitPlateNumber,
  qrToken,
  driverFullName,
  showToken = false,
  onPrintSticker,
}: PermitQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [tokenRevealed, setTokenRevealed] = useState(false)

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

  useEffect(() => {
    setTokenRevealed(false)
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
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-dark">Permit QR</div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{permitPlateNumber}</h4>
          <p className="text-sm text-slate-600">Assigned driver: {driverFullName}</p>
        </div>

        {showToken ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stored Token</div>
              <button
                type="button"
                onClick={() => setTokenRevealed((revealed) => !revealed)}
                className="text-xs font-medium text-primary-dark underline-offset-2 hover:underline"
              >
                {tokenRevealed ? 'Hide token' : 'Show token'}
              </button>
            </div>
            {tokenRevealed ? (
              <div className="mt-2 break-all font-mono text-sm text-slate-900">{qrToken}</div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Hidden so it never lands on a printed sticker.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {onPrintSticker ? (
            <button
              type="button"
              onClick={onPrintSticker}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Print sticker
            </button>
          ) : null}
          {showToken ? (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(qrToken).catch(() => {})}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Copy Token
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
