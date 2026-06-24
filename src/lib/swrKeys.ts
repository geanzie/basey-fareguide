export const SWR_KEYS = {
  authSession: "/api/auth/session",
  userProfile: "/api/user/profile",
  incidents: "/api/incidents",
  fareCalculations: "/api/fare-calculations",
  fareRates: "/api/fare-rates",
  announcements: "/api/announcements",
  riderTripStatus: "/api/public/trip-status",
  driverSession: "/api/driver/session/active",
  dashboardStats: '/api/dashboard/stats',
  dashboardActivity: '/api/dashboard/activity?limit=3',
} as const;
