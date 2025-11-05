'use client'

import { SWRConfig } from 'swr'
import { swrFetcher } from '@/lib/swr'
import { ReactNode } from 'react'

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher: swrFetcher,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 15000,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      errorRetryInterval: 3000,
    }}>
      {children}
    </SWRConfig>
  )
}
