import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Inter } from 'next/font/google'
import { AuthProvider, AuthAwareLayout } from '@/components/AuthProvider'
import { SWRProvider } from '@/components/SWRProvider'
import { resolveAuthUserFromToken } from '@/lib/auth'
import { serializeSessionUser } from '@/lib/serializers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Basey FareCheck',
  description: 'Official fare standardization system for Basey Municipality, Samar. Enhanced distance calculation for fair transportation pricing.',
  keywords: 'Basey, Samar, fare guide, transportation, Municipal Ordinance 105, jeepney, tricycle, habal-habal',
  authors: [{ name: 'Basey Municipality' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value
  const authUser = await resolveAuthUserFromToken(authToken)
  const initialSession = authUser ? { user: serializeSessionUser(authUser) } : null

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#16a34a" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} app-page-bg antialiased overflow-x-hidden`} suppressHydrationWarning>
        <SWRProvider>
          <AuthProvider initialSession={initialSession}>
          <div className="min-h-screen flex flex-col max-w-full">

            {/* Main Content with Conditional Sidebar */}
            <AuthAwareLayout>
              {children}
            </AuthAwareLayout>

            {/* Minimal Footer */}
            <footer className="hidden bg-gray-900 py-6 text-white lg:block">
              <div className="container mx-auto px-4 text-center">
                <div className="text-sm text-gray-400">
                  <p>&copy; 2025 Municipality of Basey, Samar • Municipal Ordinance 105 Series of 2023</p>
                </div>
              </div>
            </footer>
          </div>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
