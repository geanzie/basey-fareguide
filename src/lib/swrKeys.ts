export const SWR_KEYS = {
  authSession: "/api/auth/session",
  userProfile: "/api/user/profile",
  // Explicit limit: dashboard/admin views compute counts client-side over the
  // full first page (server default is 25).
  incidents: "/api/incidents?limit=100",
  fareCalculations: "/api/fare-calculations",
  fareRates: "/api/fare-rates",
  announcements: "/api/announcements",
  riderTripStatus: "/api/public/trip-status",
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
  discountMe: '/api/discount-cards/me',
  discountApplication: '/api/discount-cards/my-application',
  terminalHistory: '/api/terminal/history',
  adminUsers: '/api/admin/users',
  adminUsersPending: '/api/admin/users/pending',
  adminLocations: '/api/admin/locations',
  adminStorage: '/api/admin/storage',
  adminAnnouncements: '/api/admin/announcements',
  adminDiscountCards: '/api/admin/discount-cards',
  adminRoutingSettings: '/api/admin/settings/routing',
  adminIncidentStats: '/api/admin/incidents/stats',
  adminFareRates: '/api/admin/fare-rates',
} as const;

/** Parameterized keys — keep query-string construction in one place. */
export const swrKey = {
  permits: (query?: string) => `/api/permits${query ? `?${query}` : ''}`,
  adminReports: (period: string) => `/api/admin/reports?period=${period}`,
} as const;
