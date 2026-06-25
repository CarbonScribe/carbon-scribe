'use client';

export default function SatelliteInsightsSkeleton() {
  return (
    <div className="bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white/20 rounded-lg mr-3" />
          <div>
            <div className="h-6 w-32 bg-white/20 rounded mb-1" />
            <div className="h-4 w-40 bg-white/20 rounded" />
          </div>
        </div>
        <div className="h-6 w-28 bg-white/20 rounded-full" />
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-8 w-8 bg-white/20 rounded" />
              <div className="h-4 w-12 bg-white/20 rounded" />
            </div>
            <div className="h-8 w-16 bg-white/20 rounded mb-1" />
            <div className="h-3 w-20 bg-white/20 rounded" />
          </div>
        ))}
      </div>

      {/* Weather Forecast */}
      <div className="pt-6 border-t border-white/20">
        <div className="h-5 w-32 bg-white/20 rounded mb-4" />
        <div className="flex justify-between">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <div className="h-4 w-12 bg-white/20 rounded mb-2" />
              <div className="p-2 bg-white/10 rounded-lg mb-2">
                <div className="h-6 w-6 bg-white/20 rounded" />
              </div>
              <div className="h-5 w-12 bg-white/20 rounded mb-1" />
              <div className="h-3 w-10 bg-white/20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Button */}
      <div className="h-12 w-full bg-white/20 rounded-xl mt-6" />
    </div>
  );
}