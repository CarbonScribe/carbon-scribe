/**
 * Composition Breakdown Component
 * Displays portfolio composition by methodology, geography, SDG, vintage, and project type
 */

"use client";

import React, { useState } from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type CompositionTab =
  | "methodology"
  | "geography"
  | "sdg"
  | "vintage"
  | "projectType";

const COLORS = [
  "#0073e6",
  "#00d4aa",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#6366f1",
];

export function CompositionBreakdown() {
  const { portfolio } = useCorporate();
  const {
    composition,
    isLoadingComposition,
    compositionError,
    fetchComposition,
  } = portfolio;
  const [activeTab, setActiveTab] = useState<CompositionTab>("methodology");

  if (isLoadingComposition) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Composition</h3>
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (compositionError) {
    return (
      <div className="corporate-card p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2">
          Unable to Load Composition
        </h3>
        <p className="text-red-700 text-sm">{compositionError.message}</p>
        <button
          onClick={() => fetchComposition()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!composition) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Composition</h3>
        <p className="text-gray-500 text-sm">No composition data available.</p>
      </div>
    );
  }

  const tabs: { key: CompositionTab; label: string }[] = [
    { key: "methodology", label: "Methodology" },
    { key: "geography", label: "Geography" },
    { key: "sdg", label: "SDG Impact" },
    { key: "vintage", label: "Vintage" },
    { key: "projectType", label: "Project Type" },
  ];

  const getData = () => {
    switch (activeTab) {
      case "methodology":
        return composition.methodologyDistribution;
      case "geography":
        return composition.geographicAllocation;
      case "sdg":
        return composition.sdgImpact;
      case "vintage":
        return composition.vintageYearDistribution;
      case "projectType":
        return composition.projectTypeClassification;
      default:
        return [];
    }
  };

  const data = getData();

  return (
    <div className="corporate-card p-6">
      <h3 className="text-lg font-semibold mb-4">Portfolio Composition</h3>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.key
                ? "bg-corporate-blue text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {data.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === "vintage" || activeTab === "projectType" ? (
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    `${(value ?? 0).toLocaleString()} tCO₂`,
                    "Value",
                  ]}
                />
                <Bar dataKey="value" fill="#0073e6" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({
                    name,
                    percent,
                  }: {
                    name?: string;
                    percent?: number;
                  }) => `${name ?? ""} (${Math.round((percent ?? 0) * 100)}%)`}
                  labelLine={false}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined, name?: string) => [
                    `${(value ?? 0).toLocaleString()} tCO₂`,
                    name ?? "",
                  ]}
                />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available for {tabs.find((t) => t.key === activeTab)?.label}
        </div>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.slice(0, 6).map((item, index) => (
            <div key={item.name} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-600 truncate">{item.name}</span>
              <span className="ml-auto font-medium">{item.percentage}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompositionBreakdown;
