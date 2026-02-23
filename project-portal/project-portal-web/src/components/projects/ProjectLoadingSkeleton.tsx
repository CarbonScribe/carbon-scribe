'use client';

const ProjectLoadingSkeleton = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border-2 border-gray-200 rounded-xl p-5 animate-pulse"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-gray-200" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
              <div className="h-5 w-40 bg-gray-200 rounded" />
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>

          {/* Details */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-3 w-28 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
            <div className="h-2 bg-gray-200 rounded-full" />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
            <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProjectLoadingSkeleton;
