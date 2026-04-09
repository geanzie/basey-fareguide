import LazyRoutePlannerCalculator from '@/components/LazyRoutePlannerCalculator'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function CalculatorPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper title="Fare Calculator">
        <LazyRoutePlannerCalculator />
      </PageWrapper>
    </RoleGuard>
  )
}
