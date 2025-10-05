'use client'

import { useState } from 'react'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: string
  action: () => void
  color: string
}

const QuickActions = () => {
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketData, setTicketData] = useState({
    plateNumber: '',
    violationType: '',
    location: '',
    penalty: ''
  })

  const quickActions: QuickAction[] = [
    {
      id: 'take-next-incident',
      title: 'Take Next Incident',
      description: 'Claim the next available incident from the queue',
      icon: '🚨',
      action: () => takeNextIncident(),
      color: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-900'
    },
    {
      id: 'issue-ticket',
      title: 'Issue Ticket',
      description: 'Create a new traffic violation ticket',
      icon: '🎫',
      action: () => setShowTicketForm(true),
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-900'
    },
    {
      id: 'start-patrol',
      title: 'Start Patrol',
      description: 'Begin a new patrol route',
      icon: '🚓',
      action: () => startPatrol(),
      color: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-900'
    },
    {
      id: 'emergency-report',
      title: 'Emergency Report',
      description: 'File an urgent incident report',
      icon: '🚑',
      action: () => createEmergencyReport(),
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-900'
    },
    {
      id: 'vehicle-check',
      title: 'Vehicle Check',
      description: 'Verify vehicle permits and registration',
      icon: '🔍',
      action: () => performVehicleCheck(),
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900'
    },
    {
      id: 'backup-request',
      title: 'Request Backup',
      description: 'Call for additional enforcement support',
      icon: '📞',
      action: () => requestBackup(),
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-900'
    }
  ]

  const takeNextIncident = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/incidents/enforcer/next', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`Incident ${data.incident.id} assigned to you`)
        // Refresh incidents list or navigate to incident details
      } else {
        alert('No pending incidents available')
      }
    } catch (error) {
      console.error('Error taking next incident:', error)
      alert('Error taking next incident')
    }
  }

  const startPatrol = () => {
    // In a real implementation, this would start a patrol session
    alert('Patrol feature coming soon! This would start GPS tracking and route monitoring.')
  }

  const createEmergencyReport = () => {
    // In a real implementation, this would open emergency reporting form
    alert('Emergency reporting feature coming soon! This would create a high-priority incident.')
  }

  const performVehicleCheck = () => {
    const plateNumber = prompt('Enter vehicle plate number to check:')
    if (plateNumber) {
      // In a real implementation, this would check vehicle registration
      alert(`Checking registration for plate: ${plateNumber}. Feature coming soon!`)
    }
  }

  const requestBackup = () => {
    const location = prompt('Enter your current location for backup request:')
    if (location) {
      // In a real implementation, this would send backup request
      alert(`Backup requested at: ${location}. Feature coming soon!`)
    }
  }

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(ticketData)
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`Ticket ${data.ticketNumber} issued successfully`)
        setShowTicketForm(false)
        setTicketData({ plateNumber: '', violationType: '', location: '', penalty: '' })
      } else {
        alert('Error issuing ticket')
      }
    } catch (error) {
      console.error('Error issuing ticket:', error)
      alert('Error issuing ticket')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${action.color}`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <h4 className="font-semibold mb-1">{action.title}</h4>
                  <p className="text-sm opacity-80">{action.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Today's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">3</div>
            <div className="text-sm text-blue-800">Cases Handled</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">2</div>
            <div className="text-sm text-green-800">Tickets Issued</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">1.5h</div>
            <div className="text-sm text-purple-800">Avg Resolution</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">4.2km</div>
            <div className="text-sm text-orange-800">Patrol Distance</div>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📞 Emergency Contacts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
            <span className="text-xl">🚨</span>
            <div>
              <div className="font-medium text-red-900">Emergency</div>
              <div className="text-sm text-red-700">911</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <span className="text-xl">🏛️</span>
            <div>
              <div className="font-medium text-blue-900">Municipal Office</div>
              <div className="text-sm text-blue-700">09177140798</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <span className="text-xl">🚔</span>
            <div>
              <div className="font-medium text-green-900">Traffic Control</div>
              <div className="text-sm text-green-700">09985986570</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Form Modal */}
      {showTicketForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-bold text-gray-900 mb-4">🎫 Issue Traffic Ticket</h3>
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={ticketData.plateNumber}
                    onChange={(e) => setTicketData({...ticketData, plateNumber: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Violation Type
                  </label>
                  <select
                    value={ticketData.violationType}
                    onChange={(e) => setTicketData({...ticketData, violationType: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select violation</option>
                    <option value="FARE_OVERCHARGE">Fare Overcharge</option>
                    <option value="RECKLESS_DRIVING">Reckless Driving</option>
                    <option value="VEHICLE_VIOLATION">Vehicle Violation</option>
                    <option value="ROUTE_VIOLATION">Route Violation</option>
                    <option value="NO_PERMIT">No Permit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={ticketData.location}
                    onChange={(e) => setTicketData({...ticketData, location: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Penalty Amount (₱)
                  </label>
                  <input
                    type="number"
                    value={ticketData.penalty}
                    onChange={(e) => setTicketData({...ticketData, penalty: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTicketForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Issue Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickActions