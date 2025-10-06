'use client'

import { useState, useEffect } from 'react'

interface StorageStats {
  storage: {
    total: {
      files: number
      sizeBytes: number
      sizeMB: number
    }
    byType: Array<{
      fileType: string
      _count: { id: number }
      _sum: { fileSize: number | null }
    }>
  }
  incidents: {
    byStatus: Array<{
      status: string
      _count: { id: number }
    }>
    oldResolvedIncidents: number
  }
  recommendations: {
    cleanupNeeded: boolean
    oldIncidentsCount: number
  }
}

interface CleanupPreview {
  incidents: number
  totalFiles: number
  totalSizeMB: number
  cutoffDate: string
}

export default function StorageManagement() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [daysOld, setDaysOld] = useState(30)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/storage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        throw new Error('Failed to fetch storage stats')
      }
    } catch (error) {
      console.error('Error fetching storage stats:', error)
      setMessage({ type: 'error', text: 'Failed to load storage statistics' })
    } finally {
      setLoading(false)
    }
  }

  const previewCleanup = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/storage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daysOld, dryRun: true })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCleanupPreview(data)
      } else {
        throw new Error('Failed to preview cleanup')
      }
    } catch (error) {
      console.error('Error previewing cleanup:', error)
      setMessage({ type: 'error', text: 'Failed to preview cleanup' })
    }
  }

  const performCleanup = async () => {
    if (!window.confirm(`Are you sure you want to delete evidence files from incidents resolved more than ${daysOld} days ago? This action cannot be undone.`)) {
      return
    }

    setCleaning(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/storage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daysOld, dryRun: false })
      })
      
      if (response.ok) {
        const data = await response.json()
        setMessage({ type: 'success', text: data.message })
        setCleanupPreview(null)
        await fetchStats() // Refresh stats
      } else {
        throw new Error('Cleanup failed')
      }
    } catch (error) {
      console.error('Error performing cleanup:', error)
      setMessage({ type: 'error', text: 'Cleanup operation failed' })
    } finally {
      setCleaning(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Storage Statistics */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Evidence Storage Management</h2>
        
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {stats && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {stats.storage.total.files}
                </div>
                <div className="text-sm text-gray-600">Total Evidence Files</div>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-xl">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {stats.storage.total.sizeMB} MB
                </div>
                <div className="text-sm text-gray-600">Total Storage Used</div>
              </div>
              <div className="text-center p-6 bg-amber-50 rounded-xl">
                <div className="text-3xl font-bold text-amber-600 mb-2">
                  {stats.incidents.oldResolvedIncidents}
                </div>
                <div className="text-sm text-gray-600">Old Resolved Incidents</div>
              </div>
            </div>

            {/* Recommendations */}
            {stats.recommendations.cleanupNeeded && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <span className="text-yellow-500 text-xl mr-3">⚠️</span>
                  <div>
                    <p className="text-yellow-800 font-semibold">Storage Cleanup Recommended</p>
                    <p className="text-yellow-700 text-sm">
                      Evidence storage is over 50MB. Consider cleaning up old resolved incidents.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* File Type Breakdown */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Storage by File Type</h3>
              <div className="space-y-3">
                {stats.storage.byType.map((type) => (
                  <div key={type.fileType} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{type.fileType}</span>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">{type._count.id} files</div>
                      <div className="text-sm text-gray-500">
                        {Math.round((type._sum.fileSize || 0) / (1024 * 1024) * 100) / 100} MB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cleanup Section */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Evidence Cleanup</h3>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600 mb-4">
                  Clean up evidence files from incidents that have been resolved for more than a specified number of days.
                </p>
                
                <div className="flex items-center space-x-4 mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Delete files older than:
                  </label>
                  <input
                    type="number"
                    value={daysOld}
                    onChange={(e) => setDaysOld(parseInt(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    min="1"
                  />
                  <span className="text-sm text-gray-600">days</span>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={previewCleanup}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Preview Cleanup
                  </button>
                  
                  {cleanupPreview && (
                    <button
                      onClick={performCleanup}
                      disabled={cleaning}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 text-sm font-medium"
                    >
                      {cleaning ? 'Cleaning...' : 'Perform Cleanup'}
                    </button>
                  )}
                </div>

                {/* Cleanup Preview */}
                {cleanupPreview && (
                  <div className="mt-4 p-4 bg-white rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-3">Cleanup Preview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-700">Incidents</div>
                        <div className="text-gray-600">{cleanupPreview.incidents}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700">Files</div>
                        <div className="text-gray-600">{cleanupPreview.totalFiles}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700">Size</div>
                        <div className="text-gray-600">{cleanupPreview.totalSizeMB} MB</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700">Cutoff Date</div>
                        <div className="text-gray-600">
                          {new Date(cleanupPreview.cutoffDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}