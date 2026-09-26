import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import { AuthProvider, AuthAwareLayout } from '@/components/AuthProvider'
import SiteFooter from '@/components/SiteFooter'
import { SWRProvider } from '@/components/SWRProvider'
import { FeedbackProvider } from '@/ui/FeedbackProvider'
import { resolveAuthUserFromToken } from '@/lib/auth'
import { serializeSessionUser } from '@/lib/serializers'
import './globals.css'

// next/font registers Inter under a hashed family name, so Tailwind's
// `font-sans` must reach it through this variable, not the literal 'Inter'.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// Wordmark face from the brand kit; exposed as the `font-brand` utility.
const brand = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '800'],
  variable: '--font-brand',
})

export const metadata: Metadata = {
  title: 'Basey FareCheck',
  description: 'Official fare standardization system for Basey Municipality, Samar. Enhanced distance calculation for fair transportation pricing.',
  keywords: 'Basey, Samar, fare guide, transportation, Municipal Ordinance 105, jeepney, tricycle, habal-habal',
  authors: [{ name: 'Basey Municipality' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Basey FareCheck',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14532D',
  // Required for env(safe-area-inset-*) to resolve to anything but 0px on
  // notched devices — globals.css builds the tab bar and sheet padding on it,
  // and manifest.json runs the app in standalone mode.
  viewportFit: 'cover' as const,
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
    <html lang="en" className={`${inter.variable} ${brand.variable}`} data-scroll-behavior="smooth">
      <body className={`${inter.className} bg-surface-bg antialiased overflow-x-hidden`} suppressHydrationWarning>
        <SWRProvider>
          <AuthProvider initialSession={initialSession}>
          <FeedbackProvider>
          <div className="flex min-h-dvh max-w-full flex-col">

            {/* Main Content with Conditional Sidebar */}
            <AuthAwareLayout>
              {children}
            </AuthAwareLayout>

            <SiteFooter />
          </div>
          </FeedbackProvider>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
