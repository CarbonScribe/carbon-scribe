/**
 * Portfolio Holdings Component
 * Displays a paginated list of carbon credit holdings
 */

"use client";

import React, { useState } from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import { ChevronRight, AlertCircle } from "lucide-react";

export function PortfolioHoldings() {
  const { portfolio } = useCorporate();
  const { holdings, isLoadingHoldings, holdingsError, fetchHoldings } =
    portfolio;
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchHoldings({ page, pageSize: holdings?.pageSize || 10 });
  };

  if (isLoadingHoldings) {
    return (
      <div className="corporate-card p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Loading Holdings...</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (holdingsError) {
    return (
      <div className="corporate-card p-6 mb-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Unable to Load Holdings
        </h3>
        <p className="text-red-700 text-sm mb-4">{holdingsError.message}</p>
        <button
          onClick={() => fetchHoldings({ page: currentPage })}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!holdings || holdings.holdings.length === 0) {
    return (
      <div className="corporate-card p-6 mb-6 bg-amber-50 border-l-4 border-amber-500">
        <p className="text-amber-800">
          No carbon credit holdings found in your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold mb-4">Carbon Credit Holdings</h2>

      <div className="corporate-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Current Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Methodology
                </th>
                <th className="px-6 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {holdings.holdings.map((holding) => (
                <tr
                  key={holding.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {holding.credit.projectName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {holding.credit.country} • Vintage{" "}
                        {holding.credit.vintage}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">
                      {holding.creditAmount.toLocaleString()} tCO₂e
                    </p>
                    <p className="text-xs text-gray-500">
                      @ ${holding.purchasePrice.toFixed(2)}/t
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        holding.status === "available"
                          ? "bg-green-100 text-green-800"
                          : holding.status === "retired"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {holding.status.charAt(0).toUpperCase() +
                        holding.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">
                      ${holding.currentValue.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-medium">
                      {holding.credit.methodology}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                      <ChevronRight size={18} className="text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {holdings.totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {(currentPage - 1) * holdings.pageSize + 1} to{" "}
            {Math.min(currentPage * holdings.pageSize, holdings.total)} of{" "}
            {holdings.total} holdings
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Previous
            </button>
            {Array.from({ length: holdings.totalPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    page === currentPage
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ),
            )}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === holdings.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioHoldings;
