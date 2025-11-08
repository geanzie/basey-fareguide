'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { flexibleFetch } from '@/lib/api'

interface HistoryItem {
  id: string
  type: 'route' | 'incident'
  title: string
  subtitle: string
  description: string
  status?: string
  fare?: string
  date: string
  createdAt: string
}

interface Route {
  id: string
  from: string
  to: string
  distance: string
  fare: string
  actualFare?: string | null
  calculationType: string
  date: string
  vehicleType?: string | null
  plateNumber?: string | null
  createdAt: string
}

interface Incident {
  id: string
  type: string
  description: string
  location: string
  plateNumber?: string
  vehicleType?: string
  date: string
  status: string
  ticketNumber?: string | null
  createdAt: string
  updatedAt: string
}

interface HistoryResponse {
  routes: Route[]
  incidents: Incident[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function UserHistory() {
  const searchParams = useSearchParams()
  const urlFilter = searchParams.get('filter')
  // Map 'reports' to 'incidents' for backwards compatibility
  const initialFilter = urlFilter === 'reports' ? 'incidents' : urlFilter as 'all' | 'routes' | 'incidents' | null
  
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [allHistoryItems, setAllHistoryItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'routes' | 'incidents'>(initialFilter || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    fetchHistory()
  }, [currentPage])

  // Handle filter changes without re-fetching data
  useEffect(() => {
    if (allHistoryItems.length > 0) {
      let filteredItems = allHistoryItems
      
      // Apply type filter
      if (filter !== 'all') {
        const filterType = filter === 'routes' ? 'route' : filter === 'incidents' ? 'incident' : filter
        filteredItems = filteredItems.filter(item => item.type === filterType)
      }
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        filteredItems = filteredItems.filter(item => {
          // Search in title (route names or incident type)
          if (item.title.toLowerCase().includes(query)) return true
          
          // Search in subtitle (location, distance)
          if (item.subtitle.toLowerCase().includes(query)) return true
          
          // Search in description
          if (item.description.toLowerCase().includes(query)) return true
          
          // Search in status
          if (item.status?.toLowerCase().includes(query)) return true
          
          // Search in date
          if (item.date.includes(query)) return true
          
          // Search in fare amount (for routes)
          if (item.fare?.toLowerCase().includes(query)) return true
          
          return false
        })
      }
      
      setHistoryItems(filteredItems)
    }
  }, [filter, searchQuery, allHistoryItems])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem('token')
      if (!token) {
        setError('You need to be logged in to view your history')
        setLoading(false)
        return
      }

      // Fetch both fare calculations (routes) and incidents
      const [fareCalculationsResult, incidentsResult] = await Promise.all([
        flexibleFetch<{calculations: any[], pagination?: any}>(`/api/fare-calculations?page=${currentPage}&limit=10`),
        flexibleFetch<{incidents: any[]}>(`/api/incidents?page=${currentPage}&limit=10`)
      ])

      // Check for authentication issues
      if (!fareCalculationsResult.success) {
        if (fareCalculationsResult.requiresAuth) {
          throw new Error('Please log in to view your calculation history')
        }
        throw new Error(`Failed to fetch calculations: ${fareCalculationsResult.message}`)
      }
      
      if (!incidentsResult.success) {
        if (incidentsResult.requiresAuth) {
          throw new Error('Please log in to view your incident history')
        }
        throw new Error(`Failed to fetch incidents: ${incidentsResult.message}`)
      }

      const fareCalculationsData = fareCalculationsResult.data || { calculations: [] }
      const incidentsData = incidentsResult.data || { incidents: [] }

      // Transform fare calculations into history items
      const routeItems: HistoryItem[] = (fareCalculationsData.calculations || []).map((calc: any) => ({
        id: `route-${calc.id}`,
        type: 'route' as const,
        title: `${calc.fromLocation} → ${calc.toLocation}`,
        subtitle: `${parseFloat(calc.distance.toString()).toFixed(1)} km`,
        description: `${calc.calculationType} calculation`,
        fare: `₱${parseFloat(calc.calculatedFare.toString()).toFixed(2)}`,
        date: new Date(calc.createdAt).toISOString().split('T')[0],
        createdAt: calc.createdAt
      }))

      // Transform incidents into history items
      const incidentItems: HistoryItem[] = (incidentsData.incidents || []).map((incident: Incident) => ({
        id: `incident-${incident.id}`,
        type: 'incident' as const,
        title: incident.type,
        subtitle: incident.location,
        description: incident.description,
        status: incident.status,
        date: incident.date,
        createdAt: incident.createdAt
      }))

      // Combine and sort by creation date
      let combinedItems = [...routeItems, ...incidentItems]
      
      // Sort by creation date (most recent first)
      combinedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Store all items for accurate counting
      setAllHistoryItems(combinedItems)
      
      // Apply filter for display
      let filteredItems = combinedItems
      if (filter !== 'all') {
        const filterType = filter === 'routes' ? 'route' : filter === 'incidents' ? 'incident' : filter
        filteredItems = combinedItems.filter(item => item.type === filterType)
      }

      setHistoryItems(filteredItems)
      
      // Use pagination from fare calculations for now (in a real app, you'd want combined pagination)
      setPagination(fareCalculationsData.pagination || {
        page: currentPage,
        limit: 20,
        total: combinedItems.length,
        totalPages: 1
      })
      } catch (error) {
      // Provide more detailed error messages for debugging
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Failed to load history. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'route':
        return '🚌'
      case 'incident':
        return '🚨'
      default:
        return '📄'
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    
    const statusColors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-100 text-gray-800'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const filteredCount = {
    all: allHistoryItems.length,
    routes: allHistoryItems.filter(item => item.type === 'route').length,
    incidents: allHistoryItems.filter(item => item.type === 'incident').length
  }

  if (loading && historyItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-2">Loading your history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 py-4">
            <button
              onClick={() => setFilter('all')}
              className={`flex items-center space-x-2 pb-2 border-b-2 font-medium text-sm transition-colors ${
                filter === 'all'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>📊</span>
              <span>All Activity ({filteredCount.all})</span>
            </button>
            <button
              onClick={() => setFilter('routes')}
              className={`flex items-center space-x-2 pb-2 border-b-2 font-medium text-sm transition-colors ${
                filter === 'routes'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>🚌</span>
              <span>Fare Calculations ({filteredCount.routes})</span>
            </button>
            <button
              onClick={() => setFilter('incidents')}
              className={`flex items-center space-x-2 pb-2 border-b-2 font-medium text-sm transition-colors ${
                filter === 'incidents'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>🚨</span>
              <span>Incident Reports ({filteredCount.incidents})</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              filter === 'routes' 
                ? "Search routes (e.g., 'Basey to Tacloban', location names, fare amount)..."
                : filter === 'incidents'
                ? "Search incidents (e.g., type, location, status, plate number)..."
                : "Search all activities (routes, incidents, locations, dates)..."
            }
            className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Found <span className="font-semibold text-emerald-600">{historyItems.length}</span> result{historyItems.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* History Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your complete history of fare calculations and incident reports
          </p>
        </div>

        <div className="p-6">
          {historyItems.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📋</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No Results Found' : 'No History Found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? (
                  <>
                    No items match your search "<span className="font-semibold">{searchQuery}</span>".
                    <br />
                    Try adjusting your search terms or clear the search to see all items.
                  </>
                ) : filter === 'all'
                  ? "You haven't calculated any fares or reported any incidents yet."
                  : filter === 'routes'
                  ? "You haven't calculated any fares yet."
                  : "You haven't reported any incidents yet."
                }
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Clear Search
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/calculator"
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    🧮 Calculate Fare
                  </Link>
                  <Link
                    href="/report"
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🚨 Report Incident
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {historyItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">{getItemIcon(item.type)}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {item.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.subtitle}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.description}
                          </p>
                        </div>

                        {/* Right side info */}
                        <div className="flex flex-col items-end space-y-2 ml-4">
                          {item.fare && (
                            <span className="text-sm font-semibold text-emerald-600">
                              {item.fare}
                            </span>
                          )}
                          {item.status && getStatusBadge(item.status)}
                          <span className="text-xs text-gray-500">
                            {item.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {historyItems.length > 0 && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm bg-emerald-50 text-emerald-700 rounded">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage >= pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}