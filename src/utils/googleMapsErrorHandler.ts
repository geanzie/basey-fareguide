// Enhanced Google Maps error handler with detailed diagnostics
// Add this to your googleMaps.ts file for better production debugging

export interface GoogleMapsError {
  code: string;
  message: string;
  suggestion: string;
}

export function diagnoseGoogleMapsError(error: any): GoogleMapsError {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      suggestion: 'Check your internet connection and try again'
    };
  }

  // API Key related errors
  if (error.message?.includes('API key not valid') || error.status === 'REQUEST_DENIED') {
    return {
      code: 'INVALID_API_KEY',
      message: 'Google Maps API key is invalid or not configured properly',
      suggestion: 'Verify your API key in production environment variables and check Google Cloud Console for restrictions'
    };
  }

  if (error.message?.includes('API key not found')) {
    return {
      code: 'MISSING_API_KEY',
      message: 'Google Maps API key is not set in environment variables',
      suggestion: 'Set GOOGLE_MAPS_SERVER_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your production environment'
    };
  }

  // Quota/Billing errors
  if (error.status === 'OVER_DAILY_LIMIT' || error.status === 'OVER_QUERY_LIMIT') {
    return {
      code: 'QUOTA_EXCEEDED',
      message: 'Google Maps API quota exceeded',
      suggestion: 'Check your Google Cloud Console billing and quota limits'
    };
  }

  // Service errors
  if (error.status === 'UNKNOWN_ERROR') {
    return {
      code: 'SERVICE_ERROR',
      message: 'Google Maps service is temporarily unavailable',
      suggestion: 'This is usually temporary. The system will use GPS calculation as fallback.'
    };
  }

  // Network errors
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to Google Maps services',
      suggestion: 'Check your internet connection or firewall settings'
    };
  }

  // Generic API errors
  if (error.status && error.status !== 'OK') {
    return {
      code: error.status,
      message: `Google Maps API returned status: ${error.status}`,
      suggestion: 'Check Google Maps API documentation for this status code'
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown Google Maps error',
    suggestion: 'Enable GPS fallback mode for alternative routing'
  };
}