// File: components/project-portal/financing/TokenizationStatus.tsx
"use client";

import {
  Coins,
  CreditCard,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";

const TokenizationStatus = () => {
  const credits = [
    {
      id: 1,
      name: "Rainforest Restoration",
      amount: 450,
      status: "minted",
      value: "$2,250",
      date: "Mar 15",
    },
    {
      id: 2,
      name: "Agroforestry Phase 2",
      amount: 320,
      status: "pending",
      value: "$1,600",
      date: "Apr 10",
    },
    {
      id: 3,
      name: "Soil Carbon Project",
      amount: 580,
      status: "verified",
      value: "$2,900",
      date: "Feb 28",
    },
    {
      id: 4,
      name: "Mangrove Conservation",
      amount: 210,
      status: "minted",
      value: "$1,050",
      date: "Mar 22",
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          Carbon Credit Status
        </h3>
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Coins className="w-5 h-5 text-emerald-600" />
        </div>
      </div>

      {/* Credit List */}
      <div className="space-y-4 mb-6">
        {credits.map((credit) => (
          <div
            key={credit.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">{credit.name}</div>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Calendar className="w-3 h-3 mr-1" />
                {credit.date} • {credit.amount} tCO₂
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">{credit.value}</div>
              <div
                className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                  credit.status === "minted"
                    ? "bg-emerald-100 text-emerald-700"
                    : credit.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {credit.status === "minted" ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : credit.status === "pending" ? (
                  <Clock className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingUp className="w-3 h-3 mr-1" />
                )}
                {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Summary */}
      <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-gray-900">Total Revenue</div>
          <CreditCard className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">$7,800</div>
        <div className="text-sm text-gray-600">
          From carbon credit sales this quarter
        </div>
        <div className="mt-3 flex items-center text-emerald-600">
          <TrendingUp className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">+24% from last quarter</span>
        </div>
      </div>

      <button className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
        View All Credits
      </button>
    </div>
  );
};

export default TokenizationStatus;
