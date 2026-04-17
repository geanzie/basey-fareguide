'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { PermitDto } from '@/lib/contracts'

interface BulkQrResponse {
  permits: PermitDto[]
  total: number
  truncated: boolean
}

interface BulkQrPrintSheetProps {
  onClose: () => void
}

const PRINT_STYLES = `
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
  #bulk-qr-sheet {
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
  #bulk-qr-sheet * {
    visibility: visible !important;
  }
  .bulk-qr-controls {
    display: none !important;
    visibility: hidden !important;
  }
  .bulk-qr-print-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 48mm) !important;
    gap: 3mm !important;
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
  }
  .bulk-qr-sticker-card {
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
  .bulk-qr-sticker-card img {
    width: 36mm !important;
    height: 36mm !important;
  }
}
`

function vehicleTypeLabel(raw: string): string {
  const slug = raw.replace(/_/g, '-').toLowerCase()
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export default function BulkQrPrintSheet({ onClose }: BulkQrPrintSheetProps) {
  const [fetchState, setFetchState] = useState<'loading' | 'error' | 'done'>('loading')
  const [permits, setPermits] = useState<PermitDto[]>([])
  const [truncated, setTruncated] = useState(false)
  const [qrImages, setQrImages] = useState<Record<string, string | null>>({})
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)

  // Fetch permits
  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/permits/bulk-qr', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch-failed')
        const data: BulkQrResponse = await res.json()
        setPermits(data.permits)
        setTruncated(data.truncated)
        setFetchState('done')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setFetchState('error')
        }
      })

    return () => controller.abort()
  }, [])

  // Generate QR images after fetch completes
  useEffect(() => {
    if (fetchState !== 'done') return

    const withToken = permits.filter((p) => p.qrToken)
    if (withToken.length === 0) return

    const total = withToken.length
    setGenProgress({ done: 0, total })

    const run = async () => {
      const results: Record<string, string | null> = {}

      for (let i = 0; i < withToken.length; i++) {
        const permit = withToken[i]
        try {
          results[permit.id] = await QRCode.toDataURL(permit.qrToken!, {
            errorCorrectionLevel: 'M',
            margin: 1,
            scale: 6,
            width: 180,
          })
        } catch {
          results[permit.id] = null
        }
        setGenProgress({ done: i + 1, total })
      }

      setQrImages(results)
      setGenProgress(null)
    }

    void run()
  }, [fetchState, permits])

  const isReady = fetchState === 'done' && genProgress === null

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div
        id="bulk-qr-sheet"
        className="fixed inset-0 z-[60] overflow-y-auto bg-white"
      >
        {/* Controls bar — hidden in print */}
        <div className="bulk-qr-controls sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk QR Print</h2>
            {fetchState === 'done' && (
              <p className="text-sm text-slate-500">
                {permits.length} active QR-issued permit{permits.length !== 1 ? 's' : ''}
                {truncated ? ' — showing first 200' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!isReady || permits.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Print All
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Fetching */}
          {fetchState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
              <p className="text-sm">Loading permits…</p>
            </div>
          )}

          {/* Fetch error */}
          {fetchState === 'error' && (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm font-medium text-red-600">Failed to load permits.</p>
              <p className="mt-1 text-xs text-slate-400">Check your connection and try again.</p>
            </div>
          )}

          {/* QR generation progress */}
          {fetchState === 'done' && genProgress !== null && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
              <p className="text-sm">
                Generating QR {genProgress.done} / {genProgress.total}
              </p>
            </div>
          )}

          {/* Empty state */}
          {fetchState === 'done' && genProgress === null && permits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm text-slate-500">No active QR-issued permits found.</p>
            </div>
          )}

          {/* Truncation warning */}
          {fetchState === 'done' && truncated && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Only the first 200 permits are included. Additional permits exist but were not loaded.
            </div>
          )}

          {/* QR sticker grid */}
          {fetchState === 'done' && genProgress === null && permits.length > 0 && (
            <div className="bulk-qr-print-grid grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {permits.map((permit) => {
                const imgSrc = qrImages[permit.id]
                return (
                  <div
                    key={permit.id}
                    className="bulk-qr-sticker-card flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    {/* QR image */}
                    {imgSrc != null ? (
                      <img
                        src={imgSrc}
                        alt={`QR for permit ${permit.permitPlateNumber}`}
                        className="h-[140px] w-[140px] rounded-lg border border-slate-200 bg-white p-1"
                      />
                    ) : (
                      <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 text-xs text-red-400">
                        QR failed
                      </div>
                    )}

                    {/* Permit plate — primary identifier */}
                    <div className="font-mono text-sm font-bold leading-tight text-slate-900 text-center">
                      {permit.permitPlateNumber}
                    </div>

                    {/* Driver name */}
                    <div className="text-center text-xs leading-tight text-slate-600">
                      {permit.driverFullName}
                    </div>

                    {/* Vehicle type */}
                    <div className="text-[10px] text-slate-400">
                      {vehicleTypeLabel(permit.vehicleType as string)}
                    </div>

                    {/* Scan instruction */}
                    <div className="mt-auto text-center text-[10px] italic text-slate-400">
                      Scan to verify fare payment
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
