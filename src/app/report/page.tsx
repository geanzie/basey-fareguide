import IncidentReporting from '@/components/IncidentReporting'
import Link from 'next/link'

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <span className="text-2xl mr-2">🚌</span>
              <span className="text-xl font-bold text-gray-800">Basey Fare Guide</span>
            </Link>
            
            <div className="flex space-x-4">
              <Link 
                href="/" 
                className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              >
                🏠 Home
              </Link>
              <Link 
                href="/auth" 
                className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              >
                👤 Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <IncidentReporting />
      </div>
    </div>
  )
}