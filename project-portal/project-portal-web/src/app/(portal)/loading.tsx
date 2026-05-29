export default function PortalLoading() {
  return (
    <div
      className="space-y-6 animate-pulse"
      role="status"
      aria-label="Loading portal content"
      aria-busy="true"
    >
      {/* Welcome Banner Skeleton */}
      <div className="bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white/50 rounded-lg" />
            <div className="h-4 w-80 bg-white/40 rounded" />
          </div>
          <div className="mt-4 md:mt-0">
            <div className="h-9 w-52 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Dashboard Skeleton */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-8 w-16 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Projects Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-2 border-gray-200 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-200" />
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                    <div className="h-5 w-40 bg-gray-200 rounded" />
                  </div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                </div>
                <div className="space-y-2 mb-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-200 rounded" />
                      <div className="h-3 w-32 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-gray-200 rounded-full mb-4" />
                <div className="flex gap-2">
                  <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
                  <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Alerts Skeleton */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                    <div className="h-3 w-32 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Metrics Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="h-4 w-10 bg-gray-200 rounded" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
