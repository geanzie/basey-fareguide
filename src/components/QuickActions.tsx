'use client'

import { useState, useEffect } from 'react'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: string
  action: () => void
  color: string
}

interface IncidentReportForm {
  incidentType: string
  description: string
  location: string
  plateNumber: string
  driverLicense: string
  vehicleType: string
  incidentDate: string
  incidentTime: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  penalty: string
  evidenceDescription: string
  witnesses: string
  isTicketOnly: boolean
}

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: string
  make: string
  model: string
  color: string
  ownerName: string
  driverName: string | null
  driverLicense: string | null
  isActive: boolean
  permit: {
    id: string
    permitPlateNumber: string
    status: string
    issuedDate: string
    expiryDate: string
  } | null
}

const QuickActions = () => {
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportMode, setReportMode] = useState<'quick-ticket' | 'full-incident'>('quick-ticket')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [reportData, setReportData] = useState<IncidentReportForm>({
    incidentType: '',
    description: '',
    location: '',
    plateNumber: '',
    driverLicense: '',
    vehicleType: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: new Date().toTimeString().slice(0, 5),
    severity: 'MEDIUM',
    penalty: '',
    evidenceDescription: '',
    witnesses: '',
    isTicketOnly: true
  })

  // Official Barangays and Landmarks of Basey Municipality for location selection
  const baseyLocations = [
    // Poblacion Barangays (Urban Centers)
    'Barangay Baybay (Poblacion)',
    'Barangay Buscada (Poblacion)', 
    'Barangay Lawa-an (Poblacion)',
    'Barangay Loyo (Poblacion)',
    'Barangay Mercado (Poblacion)',
    'Barangay Palaypay (Poblacion)',
    'Barangay Sulod (Poblacion)',
    
    // Rural Barangays (A-M)
    'Barangay Amandayehan',
    'Barangay Anglit',
    'Barangay Bacubac', 
    'Barangay Balante',
    'Barangay Baloog',
    'Barangay Basiao',
    'Barangay Binongtu-an',
    'Barangay Buenavista',
    'Barangay Bulao',
    'Barangay Burgos',
    'Barangay Cambayan',
    'Barangay Can-abay',
    'Barangay Cancaiyas',
    'Barangay Canmanila',
    'Barangay Catadman',
    'Barangay Cogon',
    'Barangay Del Pilar',
    'Barangay Dolongan',
    'Barangay Guintigui-an',
    'Barangay Guirang',
    'Barangay Iba',
    'Barangay Inuntan',
    'Barangay Loog',
    'Barangay Mabini',
    'Barangay Magallanes',
    'Barangay Manlilinab',
    'Barangay May-it',
    'Barangay Mongabong',
    
    // Rural Barangays (N-Z)
    'Barangay New San Agustin',
    'Barangay Nouvelas Occidental', 
    'Barangay Old San Agustin',
    'Barangay Panugmonon',
    'Barangay Pelit',
    'Barangay Roxas',
    'Barangay Salvacion',
    'Barangay San Antonio',
    'Barangay San Fernando', 
    'Barangay Sawa',
    'Barangay Serum',
    'Barangay Sugca',
    'Barangay Sugponon',
    'Barangay Tinaogan',
    'Barangay Tingib',
    'Barangay Villa Aurora',
    
    // Key Landmarks and Municipal Facilities
    'José Rizal Monument (Basey Center - KM 0)',
    'Basey Municipal Hall',
    'Basey Public Market',
    'Basey Church (St. Michael the Archangel)',
    'Basey Central School',
    'Basey National High School',
    'Basey Port/Wharf',
    'Rural Health Unit Basey',
    'Sohoton Natural Bridge National Park',
    'Sohoton Caves',
    'Panhulugan Cliff'
  ]

  // Penalty amounts based on violation type
  const standardPenalties = {
    'FARE_OVERCHARGE': '500',
    'RECKLESS_DRIVING': '1500',
    'VEHICLE_VIOLATION': '1000',
    'ROUTE_VIOLATION': '750',
    'NO_PERMIT': '2000',
    'UNSAFE_VEHICLE': '1200',
    'DRIVER_MISCONDUCT': '800'
  }

  // Load vehicles when component mounts
  useEffect(() => {
    if (showReportForm) {
      fetchVehicles()
    }
  }, [showReportForm])

  const fetchVehicles = async () => {
    try {
      setVehiclesLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/vehicles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles || [])
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setVehiclesLoading(false)
    }
  }

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
      id: 'create-report',
      title: 'Create Report',
      description: 'Issue tickets or create incident reports',
      icon: '📋',
      action: () => openReportForm('quick-ticket'),
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
      description: 'File an urgent critical incident',
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

  const openReportForm = (mode: 'quick-ticket' | 'full-incident') => {
    setReportMode(mode)
    setReportData(prev => ({
      ...prev,
      isTicketOnly: mode === 'quick-ticket',
      severity: mode === 'quick-ticket' ? 'LOW' : 'MEDIUM'
    }))
    setShowReportForm(true)
  }

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

  const createEmergencyReport = () => {
    setReportMode('full-incident')
    setReportData(prev => ({
      ...prev,
      isTicketOnly: false,
      severity: 'CRITICAL',
      incidentType: 'EMERGENCY'
    }))
    setShowReportForm(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Auto-set penalty for violations when incident type changes
    if (name === 'incidentType' && standardPenalties[value as keyof typeof standardPenalties]) {
      setReportData(prev => ({
        ...prev,
        [name]: value,
        penalty: standardPenalties[value as keyof typeof standardPenalties]
      }))
    } else {
      setReportData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleModeChange = (mode: 'quick-ticket' | 'full-incident') => {
    setReportMode(mode)
    setReportData(prev => ({
      ...prev,
      isTicketOnly: mode === 'quick-ticket',
      severity: mode === 'quick-ticket' ? 'LOW' : prev.severity,
      evidenceDescription: mode === 'quick-ticket' ? '' : prev.evidenceDescription,
      witnesses: mode === 'quick-ticket' ? '' : prev.witnesses
    }))
  }

  const handleVehicleSelect = (vehicleId: string) => {
    if (!vehicleId) {
      // Clear vehicle fields when no vehicle is selected
      setReportData(prev => ({
        ...prev,
        plateNumber: '',
        vehicleType: '',
        driverLicense: ''
      }))
      return
    }
    
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (vehicle) {
      setReportData(prev => ({
        ...prev,
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.vehicleType,
        driverLicense: vehicle.driverLicense || ''
      }))
    }
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      
      const submitData = {
        ...reportData,
        reportedBy: 'enforcer', // Mark as enforcer-created
        assignedTo: localStorage.getItem('userId'), // Auto-assign to current enforcer
        status: reportData.isTicketOnly ? 'RESOLVED' : 'INVESTIGATING'
      }

      const endpoint = reportData.isTicketOnly ? '/api/tickets' : '/api/incidents/enforcer/create'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      })
      
      if (response.ok) {
        const data = await response.json()
        const message = reportData.isTicketOnly 
          ? `Ticket ${data.ticketNumber} issued successfully`
          : `Incident report ${data.incidentId} created successfully`
        
        alert(message)
        closeReportForm()
      } else {
        alert(`Error ${reportData.isTicketOnly ? 'issuing ticket' : 'creating incident report'}`)
      }
    } catch (error) {
      console.error('Error submitting report:', error)
      alert(`Error ${reportData.isTicketOnly ? 'issuing ticket' : 'creating incident report'}`)
    }
  }

  const closeReportForm = () => {
    setShowReportForm(false)
    setReportData({
      incidentType: '',
      description: '',
      location: '',
      plateNumber: '',
      driverLicense: '',
      vehicleType: '',
      incidentDate: new Date().toISOString().split('T')[0],
      incidentTime: new Date().toTimeString().slice(0, 5),
      severity: 'MEDIUM',
      penalty: '',
      evidenceDescription: '',
      witnesses: '',
      isTicketOnly: true
    })
  }

  // Helper function to get violation severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'text-green-600'
      case 'MEDIUM': return 'text-yellow-600'
      case 'HIGH': return 'text-orange-600'
      case 'CRITICAL': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Helper function to validate form based on mode
  const isFormValid = () => {
    const required = ['incidentType', 'plateNumber', 'location', 'description']
    const hasRequired = required.every(field => reportData[field as keyof IncidentReportForm])
    
    if (reportMode === 'quick-ticket') {
      return hasRequired && reportData.penalty
    }
    
    return hasRequired
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

      {/* Integrated Report Form Modal */}
      {showReportForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {reportMode === 'quick-ticket' ? '🎫' : reportData.severity === 'CRITICAL' ? '🚑' : '📋'}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {reportMode === 'quick-ticket' ? 'Issue Traffic Ticket' : 
                       reportData.severity === 'CRITICAL' ? 'Emergency Incident Report' : 
                       'Create Incident Report'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {reportMode === 'quick-ticket' ? 'Quick violation ticketing system' : 
                       'Comprehensive incident documentation system'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeReportForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Report Type:</span>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange('quick-ticket')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        reportMode === 'quick-ticket' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      🎫 Quick Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('full-incident')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        reportMode === 'full-incident' 
                          ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      📋 Full Report
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {reportMode === 'quick-ticket' 
                    ? 'Use for simple traffic violations that require immediate ticketing'
                    : 'Use for complex incidents requiring investigation, evidence, and detailed documentation'
                  }
                </div>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Incident Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {reportMode === 'quick-ticket' ? 'Violation Type' : 'Incident Type'} *
                      </label>
                      <select
                        name="incidentType"
                        value={reportData.incidentType}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select {reportMode === 'quick-ticket' ? 'violation' : 'incident'} type</option>
                        <option value="FARE_OVERCHARGE">Fare Overcharge</option>
                        <option value="RECKLESS_DRIVING">Reckless Driving</option>
                        <option value="VEHICLE_VIOLATION">Vehicle Violation</option>
                        <option value="ROUTE_VIOLATION">Route Violation</option>
                        <option value="NO_PERMIT">No Valid Permit</option>
                        <option value="UNSAFE_VEHICLE">Unsafe Vehicle Condition</option>
                        <option value="DRIVER_MISCONDUCT">Driver Misconduct</option>
                        {reportMode === 'full-incident' && (
                          <>
                            <option value="ACCIDENT">Traffic Accident</option>
                            <option value="EMERGENCY">Emergency Situation</option>
                            <option value="PASSENGER_COMPLAINT">Passenger Complaint</option>
                            <option value="ROAD_OBSTRUCTION">Road Obstruction</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Vehicle Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Vehicle (Optional)
                      </label>
                      <select
                        onChange={(e) => handleVehicleSelect(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={vehiclesLoading}
                      >
                        <option value="">Select registered vehicle</option>
                        {vehicles
                          .filter(vehicle => 
                            vehicle.isActive && 
                            vehicle.permit && 
                            vehicle.permit.status === 'ACTIVE' &&
                            vehicle.plateNumber && 
                            vehicle.plateNumber.trim() !== ''
                          )
                          .map(vehicle => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.plateNumber} - {vehicle.vehicleType} ({vehicle.make} {vehicle.model})
                              {vehicle.permit && ` - Permit: ${vehicle.permit.permitPlateNumber}`}
                            </option>
                          ))
                        }
                      </select>
                      {vehiclesLoading && <p className="text-xs text-gray-500 mt-1">Loading vehicles...</p>}
                      {!vehiclesLoading && vehicles.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Showing only vehicles with active permits and registration
                        </p>
                      )}
                    </div>

                    {/* Vehicle Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Plate Number *
                        </label>
                        <input
                          type="text"
                          name="plateNumber"
                          value={reportData.plateNumber}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Vehicle Type
                        </label>
                        <select
                          name="vehicleType"
                          value={reportData.vehicleType}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select type</option>
                          <option value="TRICYCLE">Tricycle</option>
                          <option value="JEEPNEY">Jeepney</option>
                          <option value="BUS">Bus</option>
                          <option value="VAN">Van</option>
                          <option value="MOTORCYCLE">Motorcycle</option>
                          <option value="CAR">Car</option>
                        </select>
                      </div>
                    </div>

                    {/* Driver License */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Driver License Number
                      </label>
                      <input
                        type="text"
                        name="driverLicense"
                        value={reportData.driverLicense}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                      </label>
                      <div className="space-y-2">
                        <select
                          onChange={(e) => setReportData(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select common location</option>
                          {baseyLocations.map(location => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name="location"
                          value={reportData.location}
                          onChange={handleInputChange}
                          placeholder="Or enter custom location"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          name="incidentDate"
                          value={reportData.incidentDate}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Time *
                        </label>
                        <input
                          type="time"
                          name="incidentTime"
                          value={reportData.incidentTime}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Severity Level */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Severity Level *
                      </label>
                      <select
                        name="severity"
                        value={reportData.severity}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="LOW">🟢 Low - Minor violation</option>
                        <option value="MEDIUM">🟡 Medium - Standard violation</option>
                        <option value="HIGH">🟠 High - Serious violation</option>
                        <option value="CRITICAL">🔴 Critical - Emergency/Safety risk</option>
                      </select>
                    </div>

                    {/* Penalty Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Penalty Amount (₱) {reportMode === 'quick-ticket' ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        name="penalty"
                        value={reportData.penalty}
                        onChange={handleInputChange}
                        min="0"
                        step="50"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required={reportMode === 'quick-ticket'}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <textarea
                        name="description"
                        value={reportData.description}
                        onChange={handleInputChange}
                        rows={reportMode === 'quick-ticket' ? 3 : 4}
                        placeholder={reportMode === 'quick-ticket' 
                          ? 'Brief description of the violation...' 
                          : 'Detailed description of the incident, what happened, when, and circumstances...'
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    {/* Additional Fields for Full Incident */}
                    {reportMode === 'full-incident' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Evidence Description
                          </label>
                          <textarea
                            name="evidenceDescription"
                            value={reportData.evidenceDescription}
                            onChange={handleInputChange}
                            rows={2}
                            placeholder="Describe any evidence collected (photos, videos, documents)..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Witnesses
                          </label>
                          <textarea
                            name="witnesses"
                            value={reportData.witnesses}
                            onChange={handleInputChange}
                            rows={2}
                            placeholder="Names and contact information of witnesses..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeReportForm}
                    className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid()}
                    className={`px-6 py-2 rounded-lg text-white font-medium transition-colors ${
                      !isFormValid() 
                        ? 'bg-gray-400 cursor-not-allowed'
                        : reportMode === 'quick-ticket' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : reportData.severity === 'CRITICAL'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {reportMode === 'quick-ticket' ? '🎫 Issue Ticket' : 
                     reportData.severity === 'CRITICAL' ? '🚑 Submit Emergency Report' :
                     '📋 Create Incident Report'}
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