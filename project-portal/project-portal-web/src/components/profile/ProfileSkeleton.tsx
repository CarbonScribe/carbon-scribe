export function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      aria-busy="true"
      className="space-y-6 animate-pulse"
    >
      {/* Summary card skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full" />
          <div className="space-y-3">
            <div className="h-5 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-56" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>

      {/* Form skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-10" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-14" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 rounded w-32" />
          <div className="h-10 bg-gray-200 rounded w-24" />
        </div>
      </div>

      <span className="sr-only">Loading profile...</span>
    </div>
  );
}
