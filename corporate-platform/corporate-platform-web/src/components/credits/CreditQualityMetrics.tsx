'use client';

import { CreditQualityBreakdown } from '@/types/credit.types';

interface CreditQualityMetricsProps {
  quality: CreditQualityBreakdown;
}

export default function CreditQualityMetrics({ quality }: CreditQualityMetricsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBar = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-blue-600';
    if (score >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const metrics = [
    { label: 'Verification', score: quality.verificationScore, description: 'Third-party verification quality' },
    { label: 'Additionality', score: quality.additionalityScore, description: 'Proves carbon removal is additional' },
    { label: 'Permanence', score: quality.permanenceScore, description: 'Long-term carbon storage certainty' },
    { label: 'Leakage', score: quality.leakageScore, description: 'Prevents displacement of emissions' },
    { label: 'Co-benefits', score: quality.cobenefitsScore, description: 'Social and environmental benefits' },
    { label: 'Transparency', score: quality.transparencyScore, description: 'Data openness and accessibility' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Quality Metrics Breakdown</h2>
      
      {/* Overall Score */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-sm text-gray-600 mb-1">Overall Dynamic Score</div>
        <div className={`text-4xl font-bold ${getScoreColor(quality.dynamicScore)}`}>
          {quality.dynamicScore.toFixed(1)}
        </div>
        <div className="text-sm text-gray-500 mt-1">out of 100</div>
      </div>

      {/* Individual Metrics */}
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-900">{metric.label}</div>
                <div className="text-sm text-gray-500">{metric.description}</div>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(metric.score)}`}>
                {metric.score.toFixed(1)}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getScoreBar(metric.score)}`}
                style={{ width: `${metric.score}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
