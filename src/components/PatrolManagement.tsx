'use client'

import { useState, useEffect } from 'react'

interface PatrolRoute {
  id: string
  name: string
  description: string
  waypoints: {
    name: string
    coordinates: { lat: number; lng: number }
    estimatedTime: number
  }[]
  totalDistance: number
  estimatedDuration: number
  priority: 'high' | 'medium' | 'low'
  lastPatrolled?: string
  incidentCount: number
}

interface PatrolLog {
  id: string
  routeId: string
  routeName: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'suspended'
  incidentsFound: number
  notes?: string
}

const PatrolManagement = () => {
  const [routes, setRoutes] = useState<PatrolRoute[]>([])
  const [logs, setLogs] = useState<PatrolLog[]>([])
  const [activePatrol, setActivePatrol] = useState<PatrolLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'routes' | 'logs' | 'active'>('routes')

  useEffect(() => {
    fetchPatrolData()
  }, [])

  const fetchPatrolData = async () => {
    try {
      setLoading(true)
      // Mock data - in real implementation, this would fetch from API
      const mockRoutes: PatrolRoute[] = [
        {
          id: '1',
          name: 'Poblacion Commercial District',
          description: 'Main market area and jeepney terminals',
          waypoints: [
            { name: 'Public Market', coordinates: { lat: 11.2758, lng: 124.9628 }, estimatedTime: 15 },
            { name: 'Jeepney Terminal', coordinates: { lat: 11.2760, lng: 124.9630 }, estimatedTime: 10 },
            { name: 'Commercial Street', coordinates: { lat: 11.2756, lng: 124.9625 }, estimatedTime: 20 }
          ],
          totalDistance: 2.5,
          estimatedDuration: 45,
          priority: 'high',
          lastPatrolled: '2024-10-05T08:30:00Z',
          incidentCount: 8
        },
        {
          id: '2',
          name: 'School Zone Route',
          description: 'Elementary and high school areas',
          waypoints: [
            { name: 'Basey Elementary', coordinates: { lat: 11.2762, lng: 124.9622 }, estimatedTime: 20 },
            { name: 'High School', coordinates: { lat: 11.2765, lng: 124.9618 }, estimatedTime: 15 },
            { name: 'School Crossing', coordinates: { lat: 11.2763, lng: 124.9620 }, estimatedTime: 10 }
          ],
          totalDistance: 1.8,
          estimatedDuration: 45,
          priority: 'high',
          lastPatrolled: '2024-10-05T07:15:00Z',
          incidentCount: 5
        },
        {
          id: '3',
          name: 'Coastal Highway',
          description: 'Main highway and port area',
          waypoints: [
            { name: 'Port Entrance', coordinates: { lat: 11.2770, lng: 124.9615 }, estimatedTime: 15 },
            { name: 'Highway Junction', coordinates: { lat: 11.2745, lng: 124.9635 }, estimatedTime: 25 },
            { name: 'Checkpoint Area', coordinates: { lat: 11.2740, lng: 124.9640 }, estimatedTime: 20 }
          ],
          totalDistance: 4.2,
          estimatedDuration: 60,
          priority: 'medium',
          lastPatrolled: '2024-10-04T16:45:00Z',
          incidentCount: 3
        }
      ]

      const mockLogs: PatrolLog[] = [
        {
          id: '1',
          routeId: '1',
          routeName: 'Poblacion Commercial District',
          startTime: '2024-10-05T08:30:00Z',
          endTime: '2024-10-05T09:15:00Z',
          status: 'completed',
          incidentsFound: 2,
          notes: 'Found 2 fare violations, both resolved with warnings'
        },
        {
          id: '2',
          routeId: '2',
          routeName: 'School Zone Route',
          startTime: '2024-10-05T07:15:00Z',
          endTime: '2024-10-05T08:00:00Z',
          status: 'completed',
          incidentsFound: 1,
          notes: 'Minor speeding violation near school entrance'
        }
      ]

      setRoutes(mockRoutes)
      setLogs(mockLogs)
      } catch (error) {} finally {
      setLoading(false)
    }
  }

  const startPatrol = (route: PatrolRoute) => {
    const newPatrol: PatrolLog = {
      id: Date.now().toString(),
      routeId: route.id,
      routeName: route.name,
      startTime: new Date().toISOString(),
      status: 'active',
      incidentsFound: 0
    }
    setActivePatrol(newPatrol)
    setLogs(prev => [newPatrol, ...prev])
  }

  const endPatrol = (notes?: string) => {
    if (activePatrol) {
      const updatedPatrol = {
        ...activePatrol,
        endTime: new Date().toISOString(),
        status: 'completed' as const,
        notes
      }
      setActivePatrol(null)
      setLogs(prev => prev.map(log => 
        log.id === activePatrol.id ? updatedPatrol : log
      ))
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diffMs = endTime.getTime() - startTime.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 60) return `${diffMins}m`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading patrol data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🚓 Patrol Management</h2>
          <p className="text-gray-600">Manage patrol routes and track enforcement activities</p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('routes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'routes' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Routes
          </button>
          <button
            onClick={() => setViewMode('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'logs' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Patrol Logs
          </button>
          <button
            onClick={() => setViewMode('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'active' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Active Patrol
          </button>
        </div>
      </div>

      {/* Active Patrol Alert */}
      {activePatrol && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse">
                <span className="text-2xl">🚓</span>
              </div>
              <div>
                <h3 className="font-medium text-blue-900">Active Patrol: {activePatrol.routeName}</h3>
                <p className="text-sm text-blue-700">
                  Started {formatTime(activePatrol.startTime)} • Duration: {formatDuration(activePatrol.startTime)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const notes = prompt('Enter patrol notes (optional):')
                endPatrol(notes || undefined)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              End Patrol
            </button>
          </div>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'routes' && (
        <div className="grid gap-6">
          {routes.map((route) => (
            <div key={route.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">📍</span>
                    {route.name}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">{route.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(route.priority)}`}>
                    {route.priority.toUpperCase()}
                  </span>
                  {!activePatrol && (
                    <button
                      onClick={() => startPatrol(route)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Patrol
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Distance</div>
                  <div className="font-semibold text-gray-900">{route.totalDistance} km</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Duration</div>
                  <div className="font-semibold text-gray-900">{route.estimatedDuration}m</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Incidents</div>
                  <div className="font-semibold text-gray-900">{route.incidentCount}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Last Patrol</div>
                  <div className="font-semibold text-gray-900">
                    {route.lastPatrolled ? formatTime(route.lastPatrolled) : 'Never'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Waypoints:</h4>
                <div className="flex flex-wrap gap-2">
                  {route.waypoints.map((waypoint, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {waypoint.name} ({waypoint.estimatedTime}m)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'logs' && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Patrol History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.id} className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{log.routeName}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                    {log.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Started:</span> {formatTime(log.startTime)}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {formatDuration(log.startTime, log.endTime)}
                  </div>
                  <div>
                    <span className="font-medium">Incidents:</span> {log.incidentsFound}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {log.status}
                  </div>
                </div>
                {log.notes && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    <span className="font-medium">Notes:</span> {log.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'active' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {activePatrol ? (
            <div className="text-center">
              <div className="text-4xl mb-4">🚓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Currently Patrolling: {activePatrol.routeName}
              </h3>
              <p className="text-gray-600 mb-4">
                Started at {formatTime(activePatrol.startTime)}
              </p>
              <div className="text-3xl font-bold text-blue-600 mb-4">
                {formatDuration(activePatrol.startTime)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{activePatrol.incidentsFound}</div>
                  <div className="text-sm text-blue-800">Incidents Found</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">Active</div>
                  <div className="text-sm text-green-800">Patrol Status</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">Live</div>
                  <div className="text-sm text-purple-800">GPS Tracking</div>
                </div>
              </div>
              <button
                onClick={() => {
                  const notes = prompt('Enter patrol notes (optional):')
                  endPatrol(notes || undefined)
                }}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
              >
                End Patrol
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🚓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Patrol</h3>
              <p className="text-gray-600 mb-4">Start a patrol route to begin tracking your enforcement activities</p>
              <button
                onClick={() => setViewMode('routes')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Available Routes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PatrolManagement