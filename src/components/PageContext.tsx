'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface PageContextData {
  title?: string
  subtitle?: string
  headerContent?: ReactNode
}

interface PageContextType {
  pageData: PageContextData
  setPageData: (data: PageContextData) => void
}

const PageContext = createContext<PageContextType | undefined>(undefined)

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageData, setPageData] = useState<PageContextData>({})

  return (
    <PageContext.Provider value={{ pageData, setPageData }}>
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (context === undefined) {
    throw new Error('usePageContext must be used within a PageProvider')
  }
  return context
}