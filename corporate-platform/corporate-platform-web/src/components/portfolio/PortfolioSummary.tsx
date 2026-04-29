/**
 * Portfolio Summary Component
 * Displays overview metrics and key performance indicators
 */

"use client";

import React from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import { TrendingUp, TrendingDown } from "lucide-react";

export function PortfolioSummary() {
  const { portfolio } = useCorporate();
  const { summary, isLoadingSummary, summaryError } = portfolio;

  if (isLoadingSummary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="corporate-card h-24 animate-pulse bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="corporate-card mb-6 p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2">
          Unable to Load Portfolio Summary
        </h3>
        <p className="text-red-700 text-sm">{summaryError.message}</p>
        <button
          onClick={() => portfolio.refresh()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="corporate-card mb-6 p-6 bg-amber-50 border-l-4 border-amber-500">
        <p className="text-amber-800">
          No portfolio data available. Please ensure you have carbon credits in
          your portfolio.
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Total Retired",
      value: summary.totalRetired.toLocaleString(),
      unit: "tCO₂e",
      color: "bg-blue-50",
    },
    {
      label: "Available Balance",
      value: summary.availableBalance.toLocaleString(),
      unit: "tCO₂e",
      color: "bg-green-50",
    },
    {
      label: "Quarterly Growth",
      value: `${summary.quarterlyGrowth.toFixed(1)}%`,
      unit: "Growth",
      color: "bg-purple-50",
      trend: summary.quarterlyGrowth >= 0 ? "up" : "down",
    },
    {
      label: "Net Zero Progress",
      value: `${summary.netZeroProgress.toFixed(1)}%`,
      unit: "Progress",
      color: "bg-emerald-50",
    },
    {
      label: "Scope 3 Coverage",
      value: `${summary.scope3Coverage.toFixed(1)}%`,
      unit: "Coverage",
      color: "bg-cyan-50",
    },
    {
      label: "SDG Alignment",
      value: `${summary.sdgAlignment.toFixed(1)}%`,
      unit: "Alignment",
      color: "bg-orange-50",
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Portfolio Overview</h2>
        <span className="text-xs text-gray-500">
          Last updated: {new Date(summary.lastUpdatedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`corporate-card p-4 ${metric.color}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  {metric.label}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {metric.value}
                </p>
                <p className="text-xs text-gray-600 mt-1">{metric.unit}</p>
              </div>
              {metric.trend && (
                <div
                  className={
                    metric.trend === "up" ? "text-green-600" : "text-red-600"
                  }
                >
                  {metric.trend === "up" ? (
                    <TrendingUp size={20} />
                  ) : (
                    <TrendingDown size={20} />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {summary.costEfficiency && (
        <div className="corporate-card p-4 mt-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Cost Efficiency
          </p>
          <p className="text-xl font-bold text-gray-900">
            ${summary.costEfficiency.toFixed(2)}/tCO₂e
          </p>
          <p className="text-xs text-gray-600 mt-1">Average Cost Per Ton</p>
        </div>
      )}
    </div>
  );
}

export default PortfolioSummary;
