import LazyIncidentReporting from '@/components/LazyIncidentReporting'
import GradientHeader from '@/ui/GradientHeader'

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <GradientHeader
        title="Report Incident"
        subtitle="File a violation report with optional photo evidence"
        compact
      />
      <div className="-mt-6 px-4 pb-8 lg:px-8">
        <LazyIncidentReporting />
      </div>
    </div>
  )
}
