'use client'

import dynamic from 'next/dynamic'

import ReportPageSkeleton from './ReportPageSkeleton'

const IncidentReporting = dynamic(() => import('./IncidentReporting'), {
  loading: () => <ReportPageSkeleton />,
  ssr: false,
})

export default function LazyIncidentReporting() {
  return <IncidentReporting />
}
