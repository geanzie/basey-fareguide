/**
 * API utility functions for handling authenticated and unauthenticated requests
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  requiresAuth?: boolean
}

/**
 * Makes an authenticated API request
 */
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers,
  })
}

/**
 * Makes an API request that gracefully handles both authenticated and unauthenticated states
 */
export async function flexibleFetch<T>(
  url: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authenticatedFetch(url, options)
    const data = await response.json()
    
    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          requiresAuth: true,
          message: data.message || 'Authentication required'
        }
      }
      return {
        success: false,
        message: data.message || `Request failed with status ${response.status}`
      }
    }
    
    return {
      success: true,
      data
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error'
    }
  }
}

