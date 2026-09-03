export const SWR_KEYS = {
  authSession: "/api/auth/session",
  userProfile: "/api/user/profile",
  // Explicit limit: dashboard/admin views compute counts client-side over the
  // full first page (server default is 25).
  incidents: "/api/incidents?limit=100",
  fareCalculations: "/api/fare-calculations",
  fareRates: "/api/fare-rates",
  // Municipal issuances behind each fare change. Authenticated, unlike fareRates.
  fareRateDocuments: "/api/fare-rates/documents",
  announcements: "/api/announcements",
  riderTripStatus: "/api/public/trip-status",
  // Which vehicle types are suspended from the driver session flow. Public, so
  // a rider can scan a permit sticker before logging in.
  tripFlowConfig: "/api/config/trip-flow",
  // Size of the QR sticker print queue: active permits whose current token has
  // never been printed. countOnly skips shipping the live tokens.
  permitQrPrintQueueCount: "/api/permits/bulk-qr?scope=unprinted&countOnly=1",
  driverSession: "/api/driver/session/active",
  dashboardStats: '/api/dashboard/stats',
  dashboardActivity: '/api/dashboard/activity?limit=3',
  driverIncidents: '/api/driver/incidents',
  driverIncidentsCount: '/api/driver/incidents/count',
  driverHistory: '/api/driver/session/history',
  driverSummary: '/api/driver/summary',
  vehicles: '/api/vehicles',
  tickets: '/api/tickets',
  enforcerIncidents: '/api/incidents/enforcer',
  feedback: '/api/feedback',
  discountMe: '/api/discount-cards/me',
  discountApplication: '/api/discount-cards/my-application',
  terminalHistory: '/api/terminal/history',
  adminUsers: '/api/admin/users',
  adminUsersPending: '/api/admin/users/pending',
  adminLocations: '/api/admin/locations',
  // The curated barangay/landmark list the rider searches. Public and served
  // with a cache header, so one fetch covers the whole session.
  plannerLocations: '/api/locations',
  // The full curated distance corpus, cached on-device so a rider can price a
  // trip offline. Public and cache-headed like the place list above.
  curatedRouteCorpus: '/api/curated-routes',
  locationRideAccess: '/api/locations/ride-access',
  adminStorage: '/api/admin/storage',
  adminAnnouncements: '/api/admin/announcements',
  adminFeedback: '/api/admin/feedback',
  adminDiscountCards: '/api/admin/discount-cards',
  adminCuratedRoutes: '/api/admin/curated-routes',
  adminRoadRestrictions: '/api/admin/road-restrictions',
  adminRoutingSettings: '/api/admin/settings/routing',
  adminDriverSessionSettings: '/api/admin/settings/driver-sessions',
  adminIncidentStats: '/api/admin/incidents/stats',
  adminFareRates: '/api/admin/fare-rates',
} as const;

/** Parameterized keys — keep query-string construction in one place. */
export const swrKey = {
  permits: (query?: string) => `/api/permits${query ? `?${query}` : ''}`,
  adminReports: (period: string) => `/api/admin/reports?period=${period}`,
  locationRideAccess: (status: string) => `/api/locations/ride-access?status=${status}`,
  adminCuratedRoutes: (query?: string) =>
    `/api/admin/curated-routes${query ? `?${query}` : ''}`,
  adminFeedback: (query?: string) =>
    `/api/admin/feedback${query ? `?${query}` : ''}`,
} as const;
