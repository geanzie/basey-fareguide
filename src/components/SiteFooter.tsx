'use client'

import { usePathname } from 'next/navigation'

import { isAuthRoute } from '@/lib/authRoutes'

/**
 * Desktop-only footer. Auth screens fill the viewport and carry the same line
 * in their own brand panel, and the landing page at `/` has its own forest
 * footer, so this one steps aside on both.
 */
export default function SiteFooter() {
  const pathname = usePathname()

  if (isAuthRoute(pathname) || pathname === '/') {
    return null
  }

  return (
    <footer className="hidden bg-gray-900 py-6 text-white lg:block">
      <div className="container mx-auto px-4 text-center">
        <div className="text-sm text-gray-400">
          <p>&copy; 2025 Municipality of Basey, Samar • Municipal Ordinance 105 Series of 2023</p>
        </div>
      </div>
    </footer>
  )
}
