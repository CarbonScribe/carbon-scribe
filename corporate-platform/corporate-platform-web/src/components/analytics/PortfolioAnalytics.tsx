'use client'

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useCorporate } from '@/contexts/CorporateContext'

// Accessible colorblind-friendly palette for methodology
const methodologyColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

// Accessible colorblind-friendly palette for regions
const regionColors = [
  'var(--color-chart-2)',
  'var(--color-chart-1)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-6)',
]

export default function PortfolioComposition() {
  const { portfolioAnalytics, portfolioLoading, portfolioError } = useCorporate();

  // Use real API data for methodology and region
  const methodologyData = portfolioAnalytics?.composition?.methodologyDistribution?.map((item, idx) => ({
    name: item.name,
    value: item.percentage,
    color: methodologyColors[idx % methodologyColors.length],
  })) || [];

  const regionData = portfolioAnalytics?.composition?.geographicAllocation?.map((item, idx) => ({
    name: item.name,
    value: item.percentage,
    color: regionColors[idx % regionColors.length],
  })) || [];

  // Loading state with accessible text
  if (portfolioLoading) {
    return (
      <div className="corporate-card p-6 h-full flex items-center justify-center">
        <div 
          className="p-8 text-center text-text-secondary dark:text-gray-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div 
              className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state with accessible text
  if (portfolioError) {
    return (
      <div className="corporate-card p-6 h-full flex items-center justify-center">
        <div 
          className="p-8 text-center text-status-error dark:text-red-400"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Error loading portfolio data</p>
          <p className="text-sm mt-1">{portfolioError}</p>
        </div>
      </div>
    );
  }

  const totalSdgs = portfolioAnalytics?.composition?.sdgImpact?.length || 0;

  return (
    <div className="corporate-card p-6 h-full">
      <h2 className="text-xl font-bold text-text-primary dark:text-white mb-6">
        Portfolio Composition
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Methodology Section */}
        <div>
          <h3 className="font-medium mb-4 text-text-secondary dark:text-gray-300">
            By Methodology
          </h3>
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
                labelLine={false}
              >
                {methodologyData.map((entry, index) => (
                  <Cell 
                    key={`methodology-cell-${index}`} 
                    fill={entry.color}
                    stroke="var(--color-background-card)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, 'Share']}
                contentStyle={{
                  backgroundColor: 'var(--color-background-card)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                labelStyle={{
                  color: 'var(--color-text-secondary)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {methodologyData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2 shrink-0" 
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-text-secondary dark:text-gray-300">{item.name}</span>
                </div>
                <span className="font-medium text-text-primary dark:text-gray-100">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Region Section */}
        <div>
          <h3 className="font-medium mb-4 text-text-secondary dark:text-gray-300">
            By Region
          </h3>
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
                labelLine={false}
              >
                {regionData.map((entry, index) => (
                  <Cell 
                    key={`region-cell-${index}`} 
                    fill={entry.color}
                    stroke="var(--color-background-card)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, 'Share']}
                contentStyle={{
                  backgroundColor: 'var(--color-background-card)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                labelStyle={{
                  color: 'var(--color-text-secondary)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {regionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2 shrink-0" 
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-text-secondary dark:text-gray-300">{item.name}</span>
                </div>
                <span className="font-medium text-text-primary dark:text-gray-100">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-status-info dark:text-blue-400">
              {totalSdgs}
            </div>
            <div className="text-sm text-text-secondary dark:text-gray-400">
              SDGs Supported
            </div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-status-success dark:text-green-400">
              {portfolioAnalytics?.composition?.geographicAllocation?.length || 0}
            </div>
            <div className="text-sm text-text-secondary dark:text-gray-400">
              Countries
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}