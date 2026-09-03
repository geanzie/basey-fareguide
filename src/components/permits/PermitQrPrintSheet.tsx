'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'

import type { PermitDto } from '@/lib/contracts'

import PermitQrSticker from './PermitQrSticker'
import {
  PRINT_SHEET_ID,
  PRINT_STYLES,
  QR_DATA_URL_OPTIONS,
  type BulkQrResponse,
} from './permitStickerPrint'

interface PermitQrPrintSheetProps {
  /**
   * Explicit permits to print (the manual reprint path). When omitted the sheet
   * loads the print queue: active permits whose current QR token has never been
   * printed.
   */
  permitIds?: string[]
  onClose: () => void
  onPrinted?: (permitIds: string[]) => void
}

export default function PermitQrPrintSheet({
  permitIds,
  onClose,
  onPrinted,
}: PermitQrPrintSheetProps) {
  const [fetchState, setFetchState] = useState<'loading' | 'error' | 'done'>('loading')
  const [permits, setPermits] = useState<PermitDto[]>([])
  const [truncated, setTruncated] = useState(false)
  const [qrImages, setQrImages] = useState<Record<string, string | null>>({})
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)
  const [printAttempted, setPrintAttempted] = useState(false)
  const [markState, setMarkState] = useState<'idle' | 'saving' | 'error' | 'done'>('idle')

  const isSelection = Boolean(permitIds && permitIds.length > 0)
  const idsKey = permitIds?.join(',') ?? ''

  const requestUrl = useMemo(
    () => (idsKey ? `/api/permits/bulk-qr?ids=${encodeURIComponent(idsKey)}` : '/api/permits/bulk-qr?scope=unprinted'),
    [idsKey],
  )

  useEffect(() => {
    const controller = new AbortController()

    fetch(requestUrl, { signal: controller.signal })
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
  }, [requestUrl])

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
          results[permit.id] = await QRCode.toDataURL(permit.qrToken!, QR_DATA_URL_OPTIONS)
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

  const handlePrint = useCallback(() => {
    window.print()
    // The browser gives no signal for "actually printed", so ask instead of
    // marking optimistically — a cancelled dialog must not consume the queue.
    setPrintAttempted(true)
  }, [])

  const handleMarkPrinted = useCallback(async () => {
    const ids = permits.filter((permit) => permit.qrToken).map((permit) => permit.id)
    if (ids.length === 0) {
      setPrintAttempted(false)
      return
    }

    setMarkState('saving')

    try {
      const res = await fetch('/api/permits/qr-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permitIds: ids }),
      })

      if (!res.ok) throw new Error('mark-failed')

      setMarkState('done')
      setPrintAttempted(false)
      onPrinted?.(ids)
    } catch {
      setMarkState('error')
    }
  }, [onPrinted, permits])

  const heading = isSelection ? 'Print Selected QR Stickers' : 'QR Print Queue'

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <div id={PRINT_SHEET_ID} className="fixed inset-0 z-dialog overflow-y-auto bg-white">
        {/* Controls bar — hidden in print */}
        <div className="permit-qr-controls sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
              {fetchState === 'done' && (
                <p className="text-sm text-slate-500">
                  {permits.length} sticker{permits.length !== 1 ? 's' : ''}
                  {isSelection ? ' selected for reprint' : ' waiting to be printed'}
                  {truncated ? ' — showing first 200' : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!isReady || permits.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSelection ? 'Print' : 'Print Queue'}
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

          {/* Mark-as-printed confirmation */}
          {printAttempted && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm text-slate-700">
                Did these {permits.length} sticker{permits.length !== 1 ? 's' : ''} print correctly?
                Marking them clears them from the print queue.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleMarkPrinted()}
                  disabled={markState === 'saving'}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {markState === 'saving' ? 'Saving…' : 'Yes, mark as printed'}
                </button>
                <button
                  type="button"
                  onClick={() => setPrintAttempted(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {markState === 'error' && (
            <p className="mt-2 text-sm text-red-600">
              Could not record the print. The stickers stay in the queue — try again.
            </p>
          )}

          {markState === 'done' && !printAttempted && (
            <p className="mt-2 text-sm text-emerald-700">Marked as printed.</p>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {fetchState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
              <p className="text-sm">Loading permits…</p>
            </div>
          )}

          {fetchState === 'error' && (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm font-medium text-red-600">Failed to load permits.</p>
              <p className="mt-1 text-xs text-slate-400">Check your connection and try again.</p>
            </div>
          )}

          {fetchState === 'done' && genProgress !== null && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
              <p className="text-sm">
                Generating QR {genProgress.done} / {genProgress.total}
              </p>
            </div>
          )}

          {fetchState === 'done' && genProgress === null && permits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-sm text-slate-500">
                {isSelection
                  ? 'None of the selected permits have a QR token to print.'
                  : 'Nothing waiting to be printed.'}
              </p>
              {!isSelection && (
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  Every active permit&apos;s current QR has already been printed. To reprint a
                  sticker, close this sheet, tick the permits in the list, and use Print selected.
                </p>
              )}
            </div>
          )}

          {fetchState === 'done' && truncated && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Only the first 200 permits are included. Additional permits exist but were not loaded.
            </div>
          )}

          {fetchState === 'done' && genProgress === null && permits.length > 0 && (
            <div className="permit-qr-print-grid grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {permits.map((permit) => (
                <PermitQrSticker key={permit.id} permit={permit} qrDataUrl={qrImages[permit.id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
