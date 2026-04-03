export default function CalculatorPageSkeleton() {
  return (
    <div className="app-page-bg min-h-screen">
      <div className="container mx-auto px-4 py-5 sm:py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="app-surface-card-strong rounded-3xl p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="h-3 w-28 rounded bg-gray-200" />
                <div className="h-12 w-40 rounded bg-gray-300" />
                <div className="h-4 w-48 rounded bg-gray-200" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-9 w-24 rounded-full bg-gray-200" />
                <div className="h-9 w-24 rounded-full bg-gray-200" />
                <div className="h-9 w-32 rounded-full bg-gray-200" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="app-surface-card rounded-3xl p-5">
              <div className="space-y-2">
                <div className="h-6 w-32 rounded bg-gray-300" />
                <div className="h-4 w-52 rounded bg-gray-200" />
              </div>
              <div className="h-28 rounded-2xl bg-gray-100" />
              <div className="h-28 rounded-2xl bg-gray-100" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-11 rounded-xl bg-gray-100" />
                <div className="h-11 rounded-xl bg-gray-100" />
                <div className="h-11 rounded-xl bg-gray-100" />
                <div className="h-11 rounded-xl bg-gray-100" />
              </div>
            </div>

            <div className="app-surface-card rounded-3xl p-5">
              <div className="mb-3 h-16 rounded-xl bg-blue-50" />
              <div className="h-[520px] rounded-2xl bg-gray-100" />
            </div>
          </div>

          <div className="app-surface-card rounded-3xl p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-100" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-28 rounded bg-gray-200" />
                <div className="h-7 w-56 rounded bg-gray-300" />
                <div className="h-4 w-full max-w-xl rounded bg-gray-200" />
                <div className="h-10 w-72 rounded-xl bg-blue-50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
