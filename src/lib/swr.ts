import { authenticatedFetch } from './api'

export type SWRKey = string | [string, RequestInit?]

export class ApiError extends Error {
  status: number
  info: any
  constructor(message: string, status: number, info?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.info = info
  }
}

export async function swrFetcher<T = any>(key: SWRKey): Promise<T> {
  const [url, init] = Array.isArray(key) ? key : [key]
  const res = await authenticatedFetch(url, init)
  const data = await res.json().catch(() => undefined)
  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed with ${res.status}`, res.status, data)
  }
  return data as T
}
