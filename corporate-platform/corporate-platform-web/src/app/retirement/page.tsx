"use client";

import { useState } from "react";
import {
  Target,
  Zap,
  CheckCircle,
  FileText,
  Globe,
  TrendingUp,
  Download,
  Calendar,
  Building,
  ExternalLink,
  Shield,
  Clock,
  AlertCircle,
  Calculator,
  CreditCard,
} from "lucide-react";
import { useCorporate } from "@/contexts/CorporateContext";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

export default function RetirementPage() {
  const { company, portfolio, retirements, credits } = useCorporate();
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [retirementAmount, setRetirementAmount] = useState(1000);

  // Mock retirement data by purpose
  const retirementByPurpose = [
    {
      purpose: "Scope 1 Emissions",
      amount: 18000,
      percentage: 40,
      color: "#0073e6",
    },
    {
      purpose: "Corporate Travel",
      amount: 9000,
      percentage: 20,
      color: "#00d4aa",
    },
    {
      purpose: "Data Centers",
      amount: 11250,
      percentage: 25,
      color: "#8b5cf6",
    },
    {
      purpose: "Employee Commute",
      amount: 4500,
      percentage: 10,
      color: "#f59e0b",
    },
    { purpose: "Supply Chain", amount: 2250, percentage: 5, color: "#ef4444" },
  ];

  // Monthly retirement data
  const monthlyRetirementData = [
    { month: "Jan", retired: 8000, target: 10000 },
    { month: "Feb", retired: 12000, target: 10000 },
    { month: "Mar", retired: 15000, target: 10000 },
    { month: "Apr", retired: 10000, target: 10000 },
    { month: "May", retired: 12000, target: 12000 },
    { month: "Jun", retired: 15000, target: 12000 },
  ];

  // Quick retirement purposes
  const retirementPurposes = [
    {
      id: "scope1",
      name: "Scope 1 Emissions",
      description: "Direct emissions from owned sources",
      icon: Building,
    },
    {
      id: "scope2",
      name: "Scope 2 Emissions",
      description: "Indirect emissions from purchased energy",
      icon: Zap,
    },
    {
      id: "scope3",
      name: "Scope 3 Emissions",
      description: "Other indirect emissions in value chain",
      icon: Globe,
    },
    {
      id: "corporate",
      name: "Corporate Travel",
      description: "Business travel carbon footprint",
      icon: Target,
    },
    {
      id: "events",
      name: "Events & Conferences",
      description: "Carbon footprint of corporate events",
      icon: Calendar,
    },
    {
      id: "product",
      name: "Product Carbon",
      description: "Carbon footprint of products sold",
      icon: Calculator,
    },
  ];

  // Available credits for retirement
  const availableCredits = credits
    .filter((credit) => credit.status === "available")
    .slice(0, 3);

  // Calculate totals
  const totalRetired = portfolio.totalRetired ?? 0;
  const remainingTarget = 100000 - totalRetired; // Assuming 100K target
  const completionPercentage = (totalRetired / 100000) * 100;

  return (
    <div className="space-y-6 animate-in">
      {/* Retirement Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Retirement
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Instantly retire carbon credits with transparent, on-chain
              verification and certification.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Retired</div>
              <div className="text-2xl font-bold">
                {totalRetired.toLocaleString()} tCO₂
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">
                Available for Retirement
              </div>
              <div className="text-2xl font-bold">
                {(portfolio.currentBalance ?? 0).toLocaleString()} tCO₂
              </div>
              <div className="text-xs text-blue-300">
                Ready for instant retirement
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Goal */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Progress to Net Zero
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Annual carbon neutrality target: 100,000 tCO₂
            </p>
          </div>
          <div className="text-2xl font-bold text-corporate-blue">
            {completionPercentage.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="h-4 rounded-full bg-linear-to-r from-corporate-teal to-corporate-blue"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Retired
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {totalRetired.toLocaleString()} tCO₂
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Remaining
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {remainingTarget.toLocaleString()} tCO₂
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Target
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                100,000 tCO₂
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Retirement */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Retirement Actions */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Quick Retirement
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Retire credits instantly for common purposes
                </p>
              </div>
              <Zap className="text-corporate-blue" size={24} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {retirementPurposes.map((purpose) => {
                const Icon = purpose.icon;
                return (
                  <button
                    key={purpose.id}
                    onClick={() => setSelectedPurpose(purpose.id)}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                      selectedPurpose === purpose.id
                        ? "border-corporate-blue bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-corporate-blue/50 hover:scale-[1.02]"
                    }`}
                  >
                    <div className="flex items-start mb-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                        <Icon size={20} className="text-corporate-blue" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white text-left">
                          {purpose.name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 text-left mt-1">
                          {purpose.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Amount Selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Retirement Amount
                </div>
                <div className="text-corporate-blue font-bold">
                  {retirementAmount.toLocaleString()} tCO₂
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={retirementAmount}
                  onChange={(e) =>
                    setRetirementAmount(parseInt(e.target.value))
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>100 tCO₂</span>
                  <span>5,000 tCO₂</span>
                  <span>10,000 tCO₂</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {[100, 500, 1000, 5000, 10000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setRetirementAmount(amount)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      retirementAmount === amount
                        ? "bg-corporate-blue text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {amount.toLocaleString()} tCO₂
                  </button>
                ))}
              </div>
            </div>

            {/* Available Credits */}
            <div className="mb-6">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Available Credits
              </div>
              <div className="space-y-3">
                {availableCredits.map((credit) => (
                  <div
                    key={credit.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {credit.projectName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {credit.country} • ${credit.pricePerTon}/ton
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {credit.availableAmount.toLocaleString()} tCO₂
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        available
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Retirement Button */}
            <button className="w-full corporate-btn-primary py-4 text-lg font-bold">
              <Shield className="mr-2" size={20} />
              Retire {retirementAmount.toLocaleString()} tCO₂ Now
              <span className="ml-2 text-sm font-normal opacity-90">
                (Estimated cost: $
                {(retirementAmount * 18.33).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                )
              </span>
            </button>

            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center text-sm text-green-800 dark:text-green-300">
                <CheckCircle size={16} className="mr-2 shrink-0" />
                <span>
                  Instant on-chain verification • Immutable retirement
                  certificate • Real-time reporting
                </span>
              </div>
            </div>
          </div>

          {/* Retirement History */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Retirement History
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All on-chain verified retirements
                </p>
              </div>
              <button className="corporate-btn-secondary text-sm px-4 py-2">
                <Download size={16} className="mr-2" />
                Export Certificates
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Purpose</th>
                    <th className="pb-3 font-medium">Certificate</th>
                    <th className="pb-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {retirements.map((retirement) => (
                    <tr
                      key={retirement.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(retirement.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {retirement.projectName}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-corporate-blue">
                          {retirement.amount.toLocaleString()} tCO₂
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {retirement.purpose}
                        </div>
                      </td>
                      <td className="py-4">
                        <a
                          href={retirement.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-corporate-blue hover:text-corporate-blue/80"
                        >
                          <FileText size={14} className="mr-1" />
                          View
                          <ExternalLink size={12} className="ml-1" />
                        </a>
                      </td>
                      <td className="py-4">
                        <a
                          href={`https://stellar.expert/explorer/public/tx/${retirement.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-corporate-blue"
                        >
                          <Globe size={14} className="mr-1" />
                          {retirement.transactionHash.slice(0, 8)}...
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Analytics & Stats */}
        <div className="space-y-6">
          {/* Monthly Performance */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Monthly Performance
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Retirement vs target
                </p>
              </div>
              <TrendingUp className="text-corporate-blue" size={20} />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRetirementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => [
                      `${value?.toLocaleString() ?? "0"} tCO₂`,
                      "Amount",
                    ]}
                  />
                  <Bar
                    dataKey="retired"
                    fill="#0073e6"
                    name="Retired"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="target"
                    fill="#00d4aa"
                    fillOpacity={0.3}
                    name="Target"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Retirement by Purpose */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Retirement by Purpose
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Breakdown of retired credits
                </p>
              </div>
              <Target className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-4">
              {retirementByPurpose.map((item) => (
                <div key={item.purpose}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-gray-900 dark:text-white">
                        {item.purpose}
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {item.percentage}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.amount.toLocaleString()} tCO₂
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retirement Certificate */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Latest Certificate
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Most recent retirement proof
                </p>
              </div>
              <FileText className="text-corporate-blue" size={20} />
            </div>
            <div className="bg-linear-to-br from-blue-500/10 to-teal-500/10 rounded-xl p-4 mb-4">
              <div className="text-center mb-3">
                <CheckCircle
                  size={48}
                  className="text-green-500 mx-auto mb-2"
                />
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  Retirement Verified
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Certificate #RET-2024-0015
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Date:
                  </span>
                  <span className="font-medium">March 15, 2024</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Amount:
                  </span>
                  <span className="font-bold text-corporate-blue">
                    10,000 tCO₂
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Project:
                  </span>
                  <span className="font-medium">Amazon Rainforest</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Transaction:
                  </span>
                  <span className="font-mono text-xs">0xabc...789</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="corporate-btn-secondary text-sm px-3 py-2">
                <Download size={14} className="mr-1" />
                PDF
              </button>
              <button className="corporate-btn-primary text-sm px-3 py-2">
                <ExternalLink size={14} className="mr-1" />
                View on-chain
              </button>
            </div>
          </div>

          {/* Upcoming Retirements */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Upcoming Retirements
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Scheduled for next quarter
                </p>
              </div>
              <Clock className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-3">
              {[
                {
                  project: "Q2 Report",
                  amount: 15000,
                  date: "Jun 30, 2024",
                  status: "Scheduled",
                },
                {
                  project: "Product Launch",
                  amount: 5000,
                  date: "Jul 15, 2024",
                  status: "Planned",
                },
                {
                  project: "Annual Report",
                  amount: 25000,
                  date: "Aug 31, 2024",
                  status: "Draft",
                },
              ].map((item) => (
                <div
                  key={item.project}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {item.project}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {item.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {item.amount.toLocaleString()} tCO₂
                    </div>
                    <div
                      className={`text-xs ${
                        item.status === "Scheduled"
                          ? "text-green-600"
                          : item.status === "Planned"
                            ? "text-blue-600"
                            : "text-yellow-600"
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <Shield className="text-green-500 mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                On-Chain Verification
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All retirements are permanently recorded on the Stellar
                blockchain using Soroban smart contracts, providing immutable
                proof and preventing double counting.
              </p>
            </div>
          </div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <AlertCircle className="text-blue-500 mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                Instant Reporting
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically generate compliance reports for GHG Protocol,
                CSRD, and other regulatory frameworks. Retirement certificates
                are available immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
