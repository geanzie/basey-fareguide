import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Basey Fare Guide - Municipal Ordinance 105 Series of 2023',
  description: 'Official fare standardization system for Basey Municipality, Samar. Enhanced distance calculation for fair transportation pricing.',
  keywords: 'Basey, Samar, fare guide, transportation, Municipal Ordinance 105, jeepney, tricycle, habal-habal',
  authors: [{ name: 'Basey Municipality' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#16a34a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Header - Clean and Professional */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16 lg:h-20">
                {/* Logo and Title */}
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg lg:text-xl">B</span>
                  </div>
                  <div>
                    <h1 className="text-lg lg:text-xl font-bold text-gray-900">Basey Fare Guide</h1>
                    <p className="text-xs lg:text-sm text-gray-600">Municipal Ordinance 105 • 2023</p>
                  </div>
                </div>
                
                {/* Fare Info - Desktop */}
                <div className="hidden lg:flex items-center space-x-8">
                  <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg">
                    <div className="text-sm font-semibold text-emerald-700">Base Fare</div>
                    <div className="text-lg font-bold text-emerald-600">₱15</div>
                    <div className="text-xs text-emerald-600">First 3km</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg">
                    <div className="text-sm font-semibold text-emerald-700">Additional</div>
                    <div className="text-lg font-bold text-emerald-600">₱3</div>
                    <div className="text-xs text-emerald-600">Per km</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">Report Violations</p>
                    <div className="flex space-x-3 text-sm text-emerald-600">
                      <a href="tel:09985986570" className="hover:text-emerald-700 transition-colors">
                        📞 0998-598-6570
                      </a>
                      <a href="tel:09177140798" className="hover:text-emerald-700 transition-colors">
                        📞 0917-714-0798
                      </a>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Menu Button */}
                <div className="lg:hidden">
                  <button className="p-2 text-gray-600 hover:text-emerald-600 transition-colors">
                    <span className="text-lg">📞</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer - Clean and Professional */}
          <footer className="bg-gray-900 text-white">
            <div className="container mx-auto px-4 py-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* About Section */}
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">B</span>
                    </div>
                    <h3 className="text-lg font-semibold">Basey Municipality</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Official transportation fare calculator implementing Municipal Ordinance 105 
                    Series of 2023 for standardized and fair pricing across all 51 barangays.
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-emerald-400">
                    <span>📍</span>
                    <span>Basey, Samar, Philippines</span>
                  </div>
                </div>
                
                {/* Quick Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Fare Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                      <span className="text-gray-300">Base Fare (3km)</span>
                      <span className="font-semibold text-emerald-400">₱15.00</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                      <span className="text-gray-300">Additional per km</span>
                      <span className="font-semibold text-emerald-400">₱3.00</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                      <span className="text-gray-300">Barangays Covered</span>
                      <span className="font-semibold text-emerald-400">51</span>
                    </div>
                  </div>
                </div>
                
                {/* Contact and Legal */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Report Violations</h3>
                  <div className="space-y-3 mb-6">
                    <a 
                      href="tel:09985986570" 
                      className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <span>📞</span>
                      <span className="text-emerald-400 font-medium">0998-598-6570</span>
                    </a>
                    <a 
                      href="tel:09177140798" 
                      className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <span>📞</span>
                      <span className="text-emerald-400 font-medium">0917-714-0798</span>
                    </a>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    <p className="mb-2 font-medium">Penalties for Violations:</p>
                    <ul className="space-y-1">
                      <li>• 1st Offense: ₱500</li>
                      <li>• 2nd Offense: ₱1,000</li>
                      <li>• 3rd Offense: ₱1,500 + 30 days imprisonment</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Bottom Bar */}
              <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
                <p>&copy; 2024 Municipality of Basey, Samar. All rights reserved.</p>
                <p className="mt-2 md:mt-0">Municipal Ordinance 105 Series of 2023</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
