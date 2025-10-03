import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider, AuthAwareHeader } from '@/components/AuthProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Basey Fare Guide - Municipal Ordinance 105 Series of 2023',
  description: 'Official fare standardization system for Basey Municipality, Samar. Enhanced distance calculation for fair transportation pricing.',
  keywords: 'Basey, Samar, fare guide, transportation, Municipal Ordinance 105, jeepney, tricycle, habal-habal',
  authors: [{ name: 'Basey Municipality' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#16a34a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <AuthAwareHeader />

            {/* Main Content */}
            <main className="flex-1">
              {children}
            </main>

            {/* Minimal Footer */}
            <footer className="bg-gray-900 text-white py-6">
              <div className="container mx-auto px-4 text-center">
                <div className="text-sm text-gray-400">
                  <p>&copy; 2025 Municipality of Basey, Samar • Municipal Ordinance 105 Series of 2023</p>
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
