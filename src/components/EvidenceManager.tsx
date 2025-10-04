'use client'

import { useState, useEffect } from 'react'

interface Evidence {
  id: string
  fileName: string
  fileUrl: string
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER'
  fileSize: number
  status: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_ADDITIONAL'
  remarks?: string
  createdAt: string
  reviewedAt?: string
  uploader: {
    firstName: string
    lastName: string
    email: string
  }
  reviewer?: {
    firstName: string
    lastName: string
    email: string
  }
}

interface EvidenceManagerProps {
  incidentId: string
  onClose: () => void
}

const EvidenceManager = ({ incidentId, onClose }: EvidenceManagerProps) => {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState('')
  const [reviewRemarks, setReviewRemarks] = useState('')

  useEffect(() => {
    fetchEvidence()
  }, [incidentId])

  const fetchEvidence = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/incidents/${incidentId}/evidence`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence)
      } else {
        setError('Failed to load evidence')
      }
    } catch (err) {
      setError('Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    try {
      setUploading(true)
      const token = localStorage.getItem('token')
      
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`/api/incidents/${incidentId}/evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        setSelectedFile(null)
        await fetchEvidence() // Refresh evidence list
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to upload evidence')
      }
    } catch (err) {
      setError('Failed to upload evidence')
    } finally {
      setUploading(false)
    }
  }

  const handleReviewEvidence = async (evidenceId: string) => {
    if (!reviewStatus) return

    try {
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/evidence/${evidenceId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: reviewStatus,
          remarks: reviewRemarks
        })
      })

      if (response.ok) {
        setReviewingId(null)
        setReviewStatus('')
        setReviewRemarks('')
        await fetchEvidence() // Refresh evidence list
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to review evidence')
      }
    } catch (err) {
      setError('Failed to review evidence')
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'IMAGE': return '🖼️'
      case 'VIDEO': return '🎥'
      case 'AUDIO': return '🎵'
      case 'DOCUMENT': return '📄'
      default: return '📎'
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      'PENDING_REVIEW': 'bg-yellow-100 text-yellow-800',
      'VERIFIED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'REQUIRES_ADDITIONAL': 'bg-blue-100 text-blue-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-lg bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <span className="text-2xl mr-2">📁</span>
              Evidence Management
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* File Upload Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Upload Evidence</h4>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="flex-1"
                disabled={uploading}
              />
              <button
                onClick={handleFileUpload}
                disabled={!selectedFile || uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Upload File'
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Supported formats: Images, Videos, Audio, PDF, Word documents. Max size: 10MB
            </p>
          </div>

          {/* Evidence List */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Evidence Files ({evidence.length})</h4>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading evidence...</p>
              </div>
            ) : evidence.length > 0 ? (
              <div className="grid gap-4">
                {evidence.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <span className="text-2xl">{getFileIcon(item.fileType)}</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="font-medium text-gray-900">{item.fileName}</h5>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(item.status)}`}>
                              {item.status.replace('_', ' ').toLowerCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(item.fileSize)} • Uploaded by {item.uploader.firstName} {item.uploader.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Uploaded: {formatDate(item.createdAt)}
                          </p>
                          {item.reviewer && (
                            <p className="text-xs text-gray-500">
                              Reviewed by {item.reviewer.firstName} {item.reviewer.lastName} on {formatDate(item.reviewedAt!)}
                            </p>
                          )}
                          {item.remarks && (
                            <p className="text-sm text-gray-700 mt-2 bg-gray-100 p-2 rounded">
                              <strong>Remarks:</strong> {item.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Preview/Download button */}
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {item.fileType === 'IMAGE' ? 'View' : 'Download'}
                        </a>
                        
                        {/* Review button for pending evidence */}
                        {item.status === 'PENDING_REVIEW' && (
                          <button
                            onClick={() => setReviewingId(item.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Review Form */}
                    {reviewingId === item.id && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <h6 className="font-medium text-gray-900 mb-3">Review Evidence</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Review Status
                            </label>
                            <select
                              value={reviewStatus}
                              onChange={(e) => setReviewStatus(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                              <option value="">Select status...</option>
                              <option value="VERIFIED">Verified</option>
                              <option value="REJECTED">Rejected</option>
                              <option value="REQUIRES_ADDITIONAL">Requires Additional Evidence</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Remarks (Optional)
                            </label>
                            <input
                              type="text"
                              value={reviewRemarks}
                              onChange={(e) => setReviewRemarks(e.target.value)}
                              placeholder="Add review comments..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-3">
                          <button
                            onClick={() => {
                              setReviewingId(null)
                              setReviewStatus('')
                              setReviewRemarks('')
                            }}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReviewEvidence(item.id)}
                            disabled={!reviewStatus}
                            className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            Submit Review
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <span className="text-4xl mb-2 block">📎</span>
                <p className="text-gray-500">No evidence files uploaded yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EvidenceManager