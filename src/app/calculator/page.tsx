import { unstable_cache } from 'next/cache'
import LazyRoutePlannerCalculator from '@/components/LazyRoutePlannerCalculator'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'
import { getResolvedRoutingSettings } from '@/lib/routing/settingsService'

// Layer unstable_cache on top of the module-level cache for Vercel cold-start
// durability. Revalidates at most once per hour across all workers.
const getCachedRoutingSettings = unstable_cache(
  () => getResolvedRoutingSettings(),
  ['routing-settings-primary-provider'],
  { revalidate: 3600 },
)

export default async function CalculatorPage() {
  const routingSettings = await getCachedRoutingSettings()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper title="Fare Calculator">
        <LazyRoutePlannerCalculator initialPrimaryProvider={routingSettings.primaryProvider} />
      </PageWrapper>
    </RoleGuard>
  )
}
