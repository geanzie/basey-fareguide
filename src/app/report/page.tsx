import LazyIncidentReporting from '@/components/LazyIncidentReporting'
import PageShell from '@/ui/PageShell'

export default function ReportPage() {
  return (
    <PageShell
      title="Report Incident"
      subtitle="File a violation report with optional photo evidence"
      width="narrow"
    >
      <LazyIncidentReporting />
    </PageShell>
  )
}
