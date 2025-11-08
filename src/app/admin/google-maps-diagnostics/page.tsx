'use client'

import { useState, useEffect } from 'react'

interface DiagnosticData {
  success: boolean
  diagnostics?: {
    timestamp: string
    environment: string
    apiKeys: {
      serverKey: {
        exists: boolean
        configured: boolean
      }
      clientKey: {
        exists: boolean
        configured: boolean
      }
    }
    requiredApis: string[]
    testEndpoints: Record<string, string>
  }
  apiTest?: {
    status: string
    working: boolean
    errorMessage: string | null
    resultsCount: number
  }
  recommendations?: string[]
  error?: string
}

export default function GoogleMapsDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const response = await fetch('/api/debug/google-maps')
        const data = await response.json()
        setDiagnostics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch diagnostics')
      } finally {
        setLoading(false)
      }
    }

    fetchDiagnostics()
  }, [])

  const refreshDiagnostics = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/debug/google-maps')
      const data = await response.json()
      setDiagnostics(data)
      } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh diagnostics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading diagnostics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Diagnostics</h2>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={refreshDiagnostics}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Google Maps API Diagnostics</h1>
            <button 
              onClick={refreshDiagnostics}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>

          {diagnostics && (
            <>
              {/* Environment Info */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Environment</h2>
                <div className="bg-gray-50 rounded p-4">
                  <p><strong>Environment:</strong> {diagnostics.diagnostics?.environment}</p>
                  <p><strong>Timestamp:</strong> {diagnostics.diagnostics?.timestamp}</p>
                </div>
              </div>

              {/* API Keys Status */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">API Keys Status</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded p-4">
                    <h3 className="font-medium text-gray-700 mb-2">Server Key (GOOGLE_MAPS_SERVER_API_KEY)</h3>
                    <div className="space-y-1">
                      <p className={`text-sm ${diagnostics.diagnostics?.apiKeys.serverKey.exists ? 'text-green-600' : 'text-red-600'}`}>
                        <span className={diagnostics.diagnostics?.apiKeys.serverKey.exists ? '✅' : '❌'}></span> 
                        {diagnostics.diagnostics?.apiKeys.serverKey.exists ? ' Configured' : ' Not Set'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded p-4">
                    <h3 className="font-medium text-gray-700 mb-2">Client Key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)</h3>
                    <div className="space-y-1">
                      <p className={`text-sm ${diagnostics.diagnostics?.apiKeys.clientKey.exists ? 'text-green-600' : 'text-red-600'}`}>
                        <span className={diagnostics.diagnostics?.apiKeys.clientKey.exists ? '✅' : '❌'}></span>
                        {diagnostics.diagnostics?.apiKeys.clientKey.exists ? ' Configured' : ' Not Set'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Test Results */}
              {diagnostics.apiTest && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">API Test Results</h2>
                  <div className={`border rounded p-4 ${diagnostics.apiTest.working ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center mb-2">
                      <span className={diagnostics.apiTest.working ? '✅' : '❌'}></span>
                      <span className={`ml-2 font-medium ${diagnostics.apiTest.working ? 'text-green-800' : 'text-red-800'}`}>
                        {diagnostics.apiTest.working ? 'API Working' : 'API Not Working'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Status:</strong> {diagnostics.apiTest.status}</p>
                      {diagnostics.apiTest.errorMessage && (
                        <p><strong>Error:</strong> {diagnostics.apiTest.errorMessage}</p>
                      )}
                      <p><strong>Results Count:</strong> {diagnostics.apiTest.resultsCount}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {diagnostics.recommendations && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Recommendations</h2>
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <ul className="space-y-2">
                      {diagnostics.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-blue-800">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Required APIs */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Required Google Cloud APIs</h2>
                <div className="bg-gray-50 rounded p-4">
                  <p className="text-sm text-gray-600 mb-2">Make sure these APIs are enabled in Google Cloud Console:</p>
                  <ul className="space-y-1">
                    {diagnostics.diagnostics?.requiredApis.map((api, index) => (
                      <li key={index} className="text-sm text-gray-700">• {api}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}