/**
 * Timeline Chart Component
 * Displays historical portfolio data with customizable date ranges
 */

"use client";

import React, { useState } from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type AggregationType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export function TimelineChart() {
  const { portfolio } = useCorporate();
  const { timeline, isLoadingTimeline, timelineError, fetchTimeline } =
    portfolio;
  const [aggregation, setAggregation] = useState<AggregationType>("monthly");

  const handleAggregationChange = (agg: AggregationType) => {
    setAggregation(agg);
    fetchTimeline({ aggregation: agg });
  };

  if (isLoadingTimeline) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Timeline</h3>
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (timelineError) {
    return (
      <div className="corporate-card p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2">
          Unable to Load Timeline
        </h3>
        <p className="text-red-700 text-sm">{timelineError.message}</p>
        <button
          onClick={() => fetchTimeline({ aggregation })}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Timeline</h3>
        <p className="text-gray-500 text-sm">No timeline data available.</p>
      </div>
    );
  }

  const aggregations: { key: AggregationType; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "yearly", label: "Yearly" },
  ];

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Portfolio Timeline</h3>
          <p className="text-sm text-gray-500">
            Historical performance over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aggregations.map((agg) => (
            <button
              key={agg.key}
              onClick={() => handleAggregationChange(agg.key)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                aggregation === agg.key
                  ? "bg-corporate-blue text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {agg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return aggregation === "monthly"
                  ? date.toLocaleDateString("en-US", { month: "short" })
                  : date.toLocaleDateString("en-US", {
                      month: "short",
                      year: "2-digit",
                    });
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}K`}
            />
            <Tooltip
              formatter={(value: number | undefined, name?: string) => {
                const label =
                  name === "growth"
                    ? "Growth"
                    : name === "retirements"
                      ? "Retirements"
                      : "Value";
                return [`${(value ?? 0).toLocaleString()} tCO₂`, label];
              }}
              labelFormatter={(label) =>
                `Date: ${new Date(label).toLocaleDateString()}`
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="growth"
              stroke="#0073e6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Growth"
            />
            <Line
              type="monotone"
              dataKey="retirements"
              stroke="#00d4aa"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Retirements"
            />
            <Line
              type="monotone"
              dataKey="portfolioValue"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Portfolio Value"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TimelineChart;
