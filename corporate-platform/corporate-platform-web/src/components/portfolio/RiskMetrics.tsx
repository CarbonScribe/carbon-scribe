/**
 * Risk Metrics Component
 * Displays portfolio risk analysis, diversification score, and concentration analysis
 */

"use client";

import React from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import { AlertTriangle, Shield, TrendingUp, PieChart } from "lucide-react";

export function RiskMetrics() {
  const { portfolio } = useCorporate();
  const {
    riskAnalysis,
    isLoadingRiskAnalysis,
    riskAnalysisError,
    fetchRiskAnalysis,
  } = portfolio;

  if (isLoadingRiskAnalysis) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Analysis</h3>
        <div className="space-y-4">
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (riskAnalysisError) {
    return (
      <div className="corporate-card p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2">
          Unable to Load Risk Analysis
        </h3>
        <p className="text-red-700 text-sm">{riskAnalysisError.message}</p>
        <button
          onClick={() => fetchRiskAnalysis()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!riskAnalysis) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Analysis</h3>
        <p className="text-gray-500 text-sm">
          No risk analysis data available.
        </p>
      </div>
    );
  }

  const getRiskColor = (rating: string) => {
    switch (rating) {
      case "Low":
        return "bg-green-100 text-green-800 border-green-300";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "High":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getRiskIcon = (rating: string) => {
    switch (rating) {
      case "Low":
        return <Shield className="text-green-600" size={24} />;
      case "Medium":
        return <AlertTriangle className="text-yellow-600" size={24} />;
      case "High":
        return <AlertTriangle className="text-red-600" size={24} />;
      default:
        return <Shield className="text-gray-600" size={24} />;
    }
  };

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Risk Analysis</h3>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(riskAnalysis.riskRating)}`}
        >
          {riskAnalysis.riskRating} Risk
        </div>
      </div>

      {/* Risk Rating Card */}
      <div className="flex items-center p-4 bg-gray-50 rounded-lg mb-6">
        {getRiskIcon(riskAnalysis.riskRating)}
        <div className="ml-4">
          <p className="text-sm text-gray-600">Portfolio Risk Rating</p>
          <p className="text-2xl font-bold">{riskAnalysis.riskRating}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-gray-600">Diversification Score</p>
          <p className="text-2xl font-bold text-corporate-blue">
            {riskAnalysis.diversificationScore}
          </p>
        </div>
      </div>

      {/* Concentration Analysis */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">
          Concentration Analysis
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Top Project</span>
            <div className="flex items-center">
              <span className="font-medium mr-2">
                {riskAnalysis.concentrationAnalysis.topProject.name}
              </span>
              <span className="text-sm text-gray-500">
                {riskAnalysis.concentrationAnalysis.topProject.percentage}%
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-corporate-blue h-2 rounded-full"
              style={{
                width: `${riskAnalysis.concentrationAnalysis.topProject.percentage}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Top Country</span>
            <div className="flex items-center">
              <span className="font-medium mr-2">
                {riskAnalysis.concentrationAnalysis.topCountry.name}
              </span>
              <span className="text-sm text-gray-500">
                {riskAnalysis.concentrationAnalysis.topCountry.percentage}%
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-corporate-teal h-2 rounded-full"
              style={{
                width: `${riskAnalysis.concentrationAnalysis.topCountry.percentage}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-600">Herfindahl Index</span>
          <span className="font-medium">
            {riskAnalysis.concentrationAnalysis.herfindahlIndex.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Volatility */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Volatility</span>
          <span className="font-medium">
            {(riskAnalysis.volatility * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              riskAnalysis.volatility < 0.15
                ? "bg-green-500"
                : riskAnalysis.volatility < 0.25
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{
              width: `${Math.min(riskAnalysis.volatility * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Project Quality Distribution */}
      <div>
        <h4 className="text-sm font-semibold text-gray-600 mb-3">
          Project Quality Distribution
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-600">High Quality</p>
            <p className="text-lg font-bold text-green-700">
              {riskAnalysis.projectQualityDistribution.highQuality}
            </p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-gray-600">Medium Quality</p>
            <p className="text-lg font-bold text-yellow-700">
              {riskAnalysis.projectQualityDistribution.mediumQuality}
            </p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-600">Low Quality</p>
            <p className="text-lg font-bold text-red-700">
              {riskAnalysis.projectQualityDistribution.lowQuality}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskMetrics;
