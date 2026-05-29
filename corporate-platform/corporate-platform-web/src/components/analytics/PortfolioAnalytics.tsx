'use client'

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useCorporate } from '@/contexts/CorporateContext'

export default function PortfolioComposition() {
  const { portfolioAnalytics, portfolioLoading, portfolioError } = useCorporate();

  // Use real API data for methodology and region
  const methodologyData = portfolioAnalytics?.composition?.methodologyDistribution?.map((item, idx) => ({
    name: item.name,
    value: item.percentage,
    color: ['#0073e6', '#00d4aa', '#8b5cf6', '#f59e0b', '#6b7280'][idx % 5],
  })) || [];

  const regionData = portfolioAnalytics?.composition?.geographicAllocation?.map((item, idx) => ({
    name: item.name,
    value: item.percentage,
    color: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#6366f1'][idx % 5],
  })) || [];

  if (portfolioLoading) {
    return <div className="p-8 text-center text-lg text-gray-700 dark:text-gray-300">Loading analytics...</div>;
  }
  if (portfolioError) {
    return <div className="p-8 text-center text-red-600">{portfolioError}</div>;
  }

  const totalSdgs = portfolioAnalytics?.composition?.sdgImpact?.length || 0;

  return (
    <div className="corporate-card p-6 h-full">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Portfolio Composition</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-medium mb-4 text-gray-700 dark:text-gray-300">By Methodology</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={methodologyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {methodologyData.map((entry, index) => (
                  <Cell key={`methodology-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {methodologyData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-4 text-gray-700 dark:text-gray-300">By Region</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={regionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {regionData.map((entry, index) => (
                  <Cell key={`region-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {regionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalSdgs}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">SDGs Supported</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">8</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Countries</div>
          </div>
        </div>
      </div>
    </div>
  )
}