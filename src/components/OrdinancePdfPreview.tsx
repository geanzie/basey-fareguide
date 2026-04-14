'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface OrdinancePdfPreviewProps {
  pdfUrl: string
}

export default function OrdinancePdfPreview({
  pdfUrl,
}: OrdinancePdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [previewWidth, setPreviewWidth] = useState(720)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.max(280, Math.min(element.clientWidth - 32, 920))
      setPreviewWidth(nextWidth)
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)

      return () => {
        window.removeEventListener('resize', updateWidth)
      }
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Inline preview unavailable</h2>
          <p className="mt-3 text-sm leading-6">
            Your browser could not render the ordinance preview in-app. Open the original PDF to read the
            official document in a new tab.
          </p>
          <p className="mt-2 text-xs text-slate-500">{loadError}</p>
          <div className="mt-4">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.view}
                size={DASHBOARD_ICON_POLICY.sizes.button}
                className="mr-2"
              />
              Open PDF
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="bg-slate-100/60 p-4 lg:p-6">
      <Document
        file={pdfUrl}
        loading={
          <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading ordinance preview...
          </div>
        }
        noData={
          <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No ordinance document is available for preview.
          </div>
        }
        onLoadSuccess={({ numPages }) => {
          setLoadError(null)
          setPageCount(numPages)
        }}
        onLoadError={(error) => {
          setPageCount(null)
          setLoadError(error instanceof Error ? error.message : 'Unable to load the PDF preview.')
        }}
      >
        <div className="space-y-5">
          {pageCount
            ? Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1

                return (
                  <section
                    key={pageNumber}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Page {pageNumber} of {pageCount}
                    </div>
                    <div className="overflow-x-auto p-3 lg:p-4">
                      <Page
                        pageNumber={pageNumber}
                        width={previewWidth}
                        loading={
                          <div className="flex min-h-[18rem] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                            Loading page {pageNumber}...
                          </div>
                        }
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                    </div>
                  </section>
                )
              })
            : null}
        </div>
      </Document>
    </div>
  )
}