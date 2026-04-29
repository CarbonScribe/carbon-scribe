/**
 * Performance Chart Component
 * Displays portfolio performance trends and value over time
 */

"use client";

import React from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function PerformanceChart() {
  const { portfolio } = useCorporate();
  const {
    performance,
    isLoadingPerformance,
    performanceError,
    fetchPerformance,
  } = portfolio;

  if (isLoadingPerformance) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
        <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (performanceError) {
    return (
      <div className="corporate-card p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2">
          Unable to Load Performance
        </h3>
        <p className="text-red-700 text-sm">{performanceError.message}</p>
        <button
          onClick={() => fetchPerformance()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
        <p className="text-gray-500 text-sm">No performance data available.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = performance.performanceTrends.map((item) => ({
    month: item.month,
    value: item.value,
    retirements:
      performance.monthlyRetirements.find((r) => r.month === item.month)
        ?.value || 0,
  }));

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Performance Trends</h3>
          <p className="text-sm text-gray-500">
            Portfolio value and retirements over time
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            ${(performance.portfolioValue / 1000).toFixed(1)}K
          </p>
          <p className="text-xs text-gray-500">Total Value</p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}K`}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `$${(value ?? 0).toLocaleString()}`,
                "Value",
              ]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0073e6"
              fill="#0073e6"
              fillOpacity={0.2}
              name="Portfolio Value"
            />
            <Line
              type="monotone"
              dataKey="retirements"
              stroke="#00d4aa"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Retirements"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
        <div>
          <p className="text-xs text-gray-500">Avg Price/Ton</p>
          <p className="text-lg font-semibold">
            ${performance.avgPricePerTon.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Credits Held</p>
          <p className="text-lg font-semibold">
            {performance.creditsHeld.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Project Diversity</p>
          <p className="text-lg font-semibold">
            {performance.projectDiversity} Projects
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Avg Value</p>
          <p className="text-lg font-semibold">
            $
            {(
              performance.portfolioValue / performance.creditsHeld || 0
            ).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PerformanceChart;
