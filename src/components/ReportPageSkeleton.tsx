export default function ReportPageSkeleton() {
  return (
    <div className="app-page-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="app-surface-card animate-pulse rounded-3xl p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100" />
            <div className="mx-auto mb-3 h-8 w-56 rounded bg-gray-300" />
            <div className="mx-auto h-4 w-full max-w-md rounded bg-gray-200" />
          </div>

          <div className="mb-6 h-20 rounded-lg bg-blue-50" />

          <div className="space-y-6">
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-32 rounded-lg bg-gray-100" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="h-24 rounded-lg bg-gray-100" />
              <div className="h-24 rounded-lg bg-gray-100" />
            </div>
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-32 rounded-lg bg-gray-100" />
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="flex justify-end gap-4">
              <div className="h-12 w-24 rounded-lg bg-gray-100" />
              <div className="h-12 w-40 rounded-lg bg-red-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
