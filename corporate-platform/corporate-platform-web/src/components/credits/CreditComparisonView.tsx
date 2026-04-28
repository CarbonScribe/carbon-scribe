'use client';

import { useCreditComparison } from '@/hooks/useCredits';
import { DollarSign, MapPin, Calendar, Award } from 'lucide-react';

interface CreditComparisonProps {
  projectIds: string[];
}

export default function CreditComparisonView({ projectIds }: CreditComparisonProps) {
  const { data, loading, error } = useCreditComparison(projectIds);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Failed to load comparison</div>
      </div>
    );
  }

  if (data.points.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">No credits to compare</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Credit Comparison</h2>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Project</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Price/Ton</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Quality Score</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Country</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Methodology</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Vintage</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((point) => (
              <tr key={point.projectId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="font-medium text-gray-900">{point.projectName}</div>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-green-600 font-semibold flex items-center justify-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {point.pricePerTon}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-blue-600 font-semibold flex items-center justify-center gap-1">
                    <Award className="h-4 w-4" />
                    {point.dynamicScore.toFixed(1)}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {point.country ? (
                    <span className="flex items-center justify-center gap-1 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {point.country}
                    </span>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center text-gray-600">
                  {point.methodology || 'N/A'}
                </td>
                <td className="py-3 px-4 text-center">
                  {point.vintage ? (
                    <span className="flex items-center justify-center gap-1 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {point.vintage}
                    </span>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="py-3 px-4 text-gray-900">Average</td>
              <td className="py-3 px-4 text-center text-green-600">
                ${data.avgPrice.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-center text-blue-600">
                {data.avgScore.toFixed(1)}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
