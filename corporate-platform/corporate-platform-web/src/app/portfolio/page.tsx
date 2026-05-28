'use client'

import { useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Globe, 
  BarChart3,
  Download,
  Calendar,
  MapPin,
  Shield,
  PieChart,
  LineChart as LineChartIcon,
  Award,
  Target
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

export default function PortfolioPage() {
  const {
    portfolioSummary,
    portfolioAnalytics,
    portfolioHoldings,
    portfolioLoading,
    portfolioError,
  } = useCorporate();
  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('6m');

  // Prepare data from API
  const growthData = portfolioAnalytics?.timeline?.portfolioGrowth?.monthly?.map((item: any) => ({
    month: item.date,
    value: item.value,
    retired: portfolioAnalytics?.timeline?.retirementTrends?.monthly?.find((r: any) => r.date === item.date)?.value || 0,
  })) || [];

  const methodologyData = portfolioAnalytics?.composition?.methodologyDistribution?.map((item: any) => ({
    name: item.name,
    value: item.percentage,
    color: '#0073e6', // TODO: assign colors dynamically or from backend
  })) || [];

  const recentTransactions = portfolioHoldings.map((h) => ({
    id: h.id,
    type: h.credit?.projectName ? 'Purchase' : 'Unknown',
    project: h.credit?.projectName || 'N/A',
    amount: h.quantity,
    price: h.purchasePrice,
    date: (h as any).purchaseDate || '', // fallback if not typed
    status: 'Completed', // TODO: map real status if available
  }));

  const performanceMetrics = portfolioAnalytics ? [
    { label: 'Portfolio Value', value: `$${portfolioAnalytics.performance.portfolioValue?.toLocaleString()}`, change: '+12.5%', trend: 'up', icon: DollarSign },
    { label: 'Avg. Price/ton', value: `$${portfolioAnalytics.performance.avgPricePerTon}`, change: '-2.1%', trend: 'down', icon: TrendingDown },
    { label: 'Credits Held', value: `${portfolioAnalytics.performance.creditsHeld?.toLocaleString()} tCO₂`, change: '+8.2%', trend: 'up', icon: Package },
    { label: 'Project Diversity', value: `${portfolioAnalytics.performance.projectDiversity}`, change: '+2', trend: 'up', icon: Globe },
  ] : [];

  if (portfolioLoading) {
    return <div className="p-8 text-center text-lg">Loading portfolio data...</div>;
  }
  if (portfolioError) {
    return <div className="p-8 text-center text-red-600">{portfolioError}</div>;
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Portfolio Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Portfolio
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Track your carbon credit investments, performance, and impact analytics.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Portfolio Value</div>
              <div className="text-2xl font-bold">$1.65M</div>
              <div className="text-xs text-green-300 flex items-center">
                <TrendingUp size={12} className="mr-1" />
                +12.5% this quarter
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Carbon Neutrality Progress</div>
              <div className="text-2xl font-bold">68%</div>
              <div className="text-xs text-blue-300">2030 Target: 100%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="corporate-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Icon className="text-corporate-blue" size={20} />
                </div>
                <span className={`text-sm font-medium flex items-center ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                  {metric.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{metric.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolio Growth Chart */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Portfolio Growth</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Credit balance and retirement trends</p>
              </div>
              <div className="flex items-center space-x-2">
                {['1m', '3m', '6m', '1y', 'all'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      timeRange === range
                        ? 'bg-corporate-blue text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => [`${value?.toLocaleString() ?? '0'} tCO₂`, 'Value']}
                    labelFormatter={(label) => `Month: ${label}`}
                   />
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
                    dataKey="retired" 
                    stroke="#00d4aa" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Monthly Retirements"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Transactions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Purchase and retirement activity</p>
              </div>
              <button className="corporate-btn-secondary text-sm px-4 py-2">
                <Download size={16} className="mr-2" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Price</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(tx.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'Purchase'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {tx.type}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{tx.project}</div>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-gray-900 dark:text-white">{tx.amount.toLocaleString()} tCO₂</div>
                      </td>
                      <td className="py-4">
                        <div className="text-gray-600 dark:text-gray-400">${tx.price}/ton</div>
                      </td>
                      <td className="py-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.status === 'Completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {tx.status}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Analytics */}
        <div className="space-y-6">
          {/* Methodology Distribution */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Methodology Mix</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Portfolio composition by type</p>
              </div>
              <PieChart className="text-corporate-blue" size={20} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={methodologyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {methodologyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {methodologyData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Geographic Exposure</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Credits by country</p>
              </div>
              <Globe className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-4">
              {[
                { country: 'Brazil', percentage: 40, color: 'bg-blue-500', credits: '36K tCO₂' },
                { country: 'Indonesia', percentage: 25, color: 'bg-green-500', credits: '22.5K tCO₂' },
                { country: 'Kenya', percentage: 15, color: 'bg-purple-500', credits: '13.5K tCO₂' },
                { country: 'India', percentage: 10, color: 'bg-orange-500', credits: '9K tCO₂' },
                { country: 'Others', percentage: 10, color: 'bg-gray-500', credits: '9K tCO₂' },
              ].map((item) => (
                <div key={item.country}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${item.color}`}></div>
                      <span className="text-gray-900 dark:text-white">{item.country}</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">{item.percentage}%</div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.credits}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SDG Impact */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">SDG Impact</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Sustainable Development Goals supported</p>
              </div>
              <Award className="text-corporate-blue" size={20} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[13, 7, 15, 8, 1, 2, 6, 14, 12].map((sdg) => (
                <div
                  key={sdg}
                  className="aspect-square bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-xl flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-corporate-navy dark:text-white">{sdg}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">SDG</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Contributing to 9 out of 17 SDGs
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="corporate-card p-5">
          <div className="flex items-center mb-3">
            <Target className="text-red-500 mr-3" size={20} />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Risk Rating</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">Low</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Diversified portfolio with minimal risk</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center mb-3">
            <Calendar className="text-green-500 mr-3" size={20} />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Vintage</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">2023.8</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Recent credits with strong verification</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center mb-3">
            <MapPin className="text-purple-500 mr-3" size={20} />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Project Count</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">8</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Across 5 different countries</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center mb-3">
            <Shield className="text-blue-500 mr-3" size={20} />
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Verification Rate</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">100%</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">All credits fully verified</div>
        </div>
      </div>
    </div>
  )
}