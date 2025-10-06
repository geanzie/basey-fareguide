import Link from 'next/link'

export default function FeaturesPage() {
  const features = [
    {
      id: 'fare-calculator',
      title: 'Fare Calculator',
      icon: '🧮',
      description: 'Calculate accurate fares using route-based or GPS tracking methods',
      features: [
        'Route-based calculation with 95% accuracy',
        'Real-time GPS tracking for live fare computation',
        'All 51 barangays and landmarks database',
        'Municipal Ordinance 105 Series of 2023 compliance'
      ],
      link: '/',
      color: 'emerald'
    },
    {
      id: 'incident-reporting',
      title: 'Incident Reporting',
      icon: '📝',
      description: 'Report transportation violations with GPS and evidence',
      features: [
        'Multiple violation types (fare, driving, vehicle)',
        'GPS location capture',
        'Photo and video evidence upload',
        'Real-time status tracking'
      ],
      link: '/report',
      color: 'red'
    },
    {
      id: 'user-management',
      title: 'User Management',
      icon: '👥',
      description: 'Comprehensive user account system with role-based access',
      features: [
        '4 user types: Admin, Data Encoder, Enforcer, Public',
        'Account approval workflow',
        'Profile management',
        'Password security'
      ],
      link: '/auth',
      color: 'blue'
    },
    {
      id: 'authority-dashboard',
      title: 'Authority Dashboard',
      icon: '📊',
      description: 'Real-time system monitoring and management interface',
      features: [
        'Live incident statistics',
        'User and vehicle management',
        'Penalty tracking',
        'System reports and analytics'
      ],
      link: '/dashboard',
      color: 'yellow'
    },
    {
      id: 'incident-management',
      title: 'Incident Management',
      icon: '📋',
      description: 'Complete violation tracking and resolution system',
      features: [
        'Status workflow (Pending → Investigating → Resolved)',
        'Advanced filtering and search',
        'Evidence management',
        'Penalty assignment'
      ],
      link: '/dashboard',
      color: 'green'
    },
    {
      id: 'traffic-enforcer',
      title: 'Traffic Enforcer',
      icon: '🚔',
      description: 'Dedicated enforcement dashboard for police authorities',
      features: [
        'FIFO incident queue (First In, First Out)',
        'Priority-based incident management',
        'Ticket number assignment system',
        'Real-time incident resolution tracking'
      ],
      link: '/enforcer',
      color: 'indigo'
    }
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      emerald: 'border-emerald-500 bg-emerald-50',
      red: 'border-red-500 bg-red-50',
      blue: 'border-blue-500 bg-blue-50',
      purple: 'border-purple-500 bg-purple-50',
      yellow: 'border-yellow-500 bg-yellow-50',
      green: 'border-green-500 bg-green-50',
      indigo: 'border-indigo-500 bg-indigo-50'
    }
    return colors[color as keyof typeof colors] || 'border-gray-500 bg-gray-50'
  }

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
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Complete Transportation Management
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-3xl mx-auto">
            Explore all features of the Basey Fare Guide system - from accurate fare calculation 
            to comprehensive incident management and user administration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth"
              className="bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Sign Up Now
            </Link>
            <Link 
              href="/report"
              className="bg-emerald-800 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-900 transition-colors"
            >
              Report Incident
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">System Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our comprehensive transportation management system provides everything needed 
              for efficient fare calculation and violation management in Basey Municipality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div 
                key={feature.id}
                className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 ${getColorClasses(feature.color)} hover:shadow-xl transition-shadow`}
              >
                <div className="p-8">
                  <div className="flex items-center mb-4">
                    <span className="text-3xl mr-3">{feature.icon}</span>
                    <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                  </div>
                  
                  <p className="text-gray-600 mb-6">{feature.description}</p>
                  
                  <ul className="space-y-2 mb-6">
                    {feature.features.map((item, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-600">
                        <span className="text-green-500 mr-2 mt-1">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  
                  <Link 
                    href={feature.link}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Try Feature
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">User Access Levels</h2>
            <p className="text-gray-600">Different user types with specific permissions and capabilities</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 border border-gray-200 rounded-xl">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👑</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Administrator</h3>
              <p className="text-sm text-gray-600">Full system access, user management, system configuration</p>
            </div>

            <div className="text-center p-6 border border-gray-200 rounded-xl">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Data Encoder</h3>
              <p className="text-sm text-gray-600">Vehicle registration, driver data management, data validation</p>
            </div>

            <div className="text-center p-6 border border-gray-200 rounded-xl">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚔</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Enforcer</h3>
              <p className="text-sm text-gray-600">Incident investigation, violation processing, penalty assignment</p>
            </div>

            <div className="text-center p-6 border border-gray-200 rounded-xl">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👤</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">General Public</h3>
              <p className="text-sm text-gray-600">Fare calculation and incident reporting</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-300 mb-8 text-lg">
            Join the official transportation management system for Basey Municipality. 
            Calculate fares, report incidents, and help maintain fair transportation services.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth"
              className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Create Account
            </Link>
            <Link 
              href="/"
              className="bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Try Calculator
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}