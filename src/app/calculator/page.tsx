import LazyRoutePlannerCalculator from '@/components/LazyRoutePlannerCalculator'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'
import { getResolvedRoutingSettings } from '@/lib/routing/settingsService'

export default async function CalculatorPage() {
  const routingSettings = await getResolvedRoutingSettings()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper title="Fare Calculator">
        <LazyRoutePlannerCalculator initialPrimaryProvider={routingSettings.primaryProvider} />
      </PageWrapper>
    </RoleGuard>
  )
}
