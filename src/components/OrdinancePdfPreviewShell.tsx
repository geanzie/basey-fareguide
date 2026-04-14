'use client'

import dynamic from 'next/dynamic'

const OrdinancePdfPreview = dynamic(() => import('@/components/OrdinancePdfPreview'), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-100/60 p-4 lg:p-6">
      <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading ordinance preview...
      </div>
    </div>
  ),
})

interface OrdinancePdfPreviewShellProps {
  pdfUrl: string
}

export default function OrdinancePdfPreviewShell({
  pdfUrl,
}: OrdinancePdfPreviewShellProps) {
  return <OrdinancePdfPreview pdfUrl={pdfUrl} />
}