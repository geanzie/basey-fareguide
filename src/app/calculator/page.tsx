import { unstable_cache } from 'next/cache'
import LazyRoutePlannerCalculator from '@/components/LazyRoutePlannerCalculator'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'
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
      <PageShell
        title="Fare Calculator"
        subtitle="Plan a route and get the official fare under Ordinance 105"
        width="narrow"
      >
        {/* The band spans the page; only the controls are a form column. */}
        <div className="mx-auto w-full max-w-xl">
          <LazyRoutePlannerCalculator initialPrimaryProvider={routingSettings.primaryProvider} />
        </div>
      </PageShell>
    </RoleGuard>
  )
}
