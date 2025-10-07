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
  const token = localStorage.getItem('token')
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
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

/**
 * Checks if user is currently authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('token')
}

/**
 * Gets the current user data from localStorage
 */
export function getCurrentUser() {
  if (typeof window === 'undefined') return null
  
  try {
    const userData = localStorage.getItem('user')
    return userData ? JSON.parse(userData) : null
  } catch {
    return null
  }
}