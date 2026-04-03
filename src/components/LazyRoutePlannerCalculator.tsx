'use client'

import dynamic from 'next/dynamic'

import CalculatorPageSkeleton from './CalculatorPageSkeleton'

const RoutePlannerCalculator = dynamic(() => import('./RoutePlannerCalculator'), {
  loading: () => <CalculatorPageSkeleton />,
  ssr: false,
})

export default function LazyRoutePlannerCalculator() {
  return <RoutePlannerCalculator />
}
