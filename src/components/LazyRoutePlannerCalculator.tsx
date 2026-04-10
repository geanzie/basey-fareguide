'use client'

import dynamic from 'next/dynamic'

import CalculatorPageSkeleton from './CalculatorPageSkeleton'
import type { RoutingPrimaryProviderDto } from '@/lib/contracts'

const RoutePlannerCalculator = dynamic(() => import('./RoutePlannerCalculator'), {
  loading: () => <CalculatorPageSkeleton />,
  ssr: false,
})

interface LazyRoutePlannerCalculatorProps {
  initialPrimaryProvider?: RoutingPrimaryProviderDto
}

export default function LazyRoutePlannerCalculator({
  initialPrimaryProvider = 'ors',
}: LazyRoutePlannerCalculatorProps) {
  return <RoutePlannerCalculator initialPrimaryProvider={initialPrimaryProvider} />
}
