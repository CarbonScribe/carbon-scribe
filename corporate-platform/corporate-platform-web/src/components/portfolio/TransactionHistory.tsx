/**
 * Transaction History Component
 * Displays paginated transaction history with filters
 */

"use client";

import React, { useState } from "react";
import { useCorporate } from "@/contexts/CorporateContext";
import { Download, Filter, AlertCircle } from "lucide-react";

export default function TransactionHistory() {
  const { portfolio } = useCorporate();
  const {
    transactions,
    isLoadingTransactions,
    transactionsError,
    fetchTransactions,
  } = portfolio;
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<
    "all" | "order" | "refund" | "adjustment" | "transfer"
  >("all");

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions({ page, pageSize: 10 });
  };

  const filteredTransactions = transactions?.filter((tx: { type: string }) => {
    if (filter === "all") {
      return true;
    }
    return tx.type === filter;
  });

  if (isLoadingTransactions) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (transactionsError) {
    return (
      <div className="corporate-card p-6 bg-red-50 border-l-4 border-red-500">
        <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Unable to Load Transactions
        </h3>
        <p className="text-red-700 text-sm mb-4">{transactionsError.message}</p>
        <button
          onClick={() => fetchTransactions({ page: currentPage })}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="corporate-card p-6">
        <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
        <p className="text-gray-500 text-sm">
          No transactions found in your portfolio.
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "order":
        return "bg-blue-100 text-blue-800";
      case "refund":
        return "bg-purple-100 text-purple-800";
      case "adjustment":
        return "bg-orange-100 text-orange-800";
      case "transfer":
        return "bg-cyan-100 text-cyan-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Transaction History</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            >
              <option value="all">All Types</option>
              <option value="order">Orders</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>
          <button className="flex items-center px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
            <Download size={16} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Project
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions?.map((tx) => (
              <tr
                key={tx.id}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}
                  >
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {tx.projectName}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {tx.amount.toLocaleString()} tCO₂
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-600">
                    ${tx.pricePerUnit.toFixed(2)}/t
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    ${tx.totalPrice.toFixed(2)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}
                  >
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {transactions.length > 10 && (
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {filteredTransactions?.length || 0} transactions
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={
                filteredTransactions && filteredTransactions.length < 10
              }
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
