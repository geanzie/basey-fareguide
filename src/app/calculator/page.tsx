import { unstable_cache } from 'next/cache'
import LazyRoutePlannerCalculator from '@/components/LazyRoutePlannerCalculator'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'
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
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Fare Calculator"
          subtitle="Plan a route and get the official fare under Ordinance 105"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <LazyRoutePlannerCalculator initialPrimaryProvider={routingSettings.primaryProvider} />
        </div>
      </div>
    </RoleGuard>
  )
}
