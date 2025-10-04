import IncidentReporting from '@/components/IncidentReporting'
import Link from 'next/link'

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-4xl mx-auto px-4">
        <IncidentReporting />
      </div>
    </div>
  )
}