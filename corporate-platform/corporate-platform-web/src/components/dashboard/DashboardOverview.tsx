'use client'

import { TrendingUp, TrendingDown, DollarSign, Globe, Users, Shield } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useCorporate } from '@/contexts/CorporateContext'

const monthlyData = [
  { month: 'Jan', retired: 8000, purchased: 10000, price: 18.5 },
  { month: 'Feb', retired: 12000, purchased: 15000, price: 19.2 },
  { month: 'Mar', retired: 15000, purchased: 20000, price: 18.8 },
  { month: 'Apr', retired: 10000, purchased: 12000, price: 19.5 },
]

export default function DashboardOverview() {
  const { portfolioSummary, portfolioAnalytics } = useCorporate()

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Portfolio Performance</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Monthly carbon credit activity</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Last updated: Today</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Value', value: portfolioSummary ? `$${(portfolioSummary.availableBalance / 1000).toFixed(1)}K` : 'N/A', icon: DollarSign, change: '+8.2%', trend: 'up' },
          { label: 'Credits Retired', value: portfolioSummary ? `${(portfolioSummary.totalRetired / 1000).toFixed(1)}K` : 'N/A', icon: TrendingUp, change: '+12.5%', trend: 'up' },
          { label: 'SDG Impact', value: portfolioAnalytics?.composition?.sdgImpact ? `${portfolioAnalytics.composition.sdgImpact.length}` : 'N/A', icon: Globe, change: '+3', trend: 'up' },
          { label: 'Risk Score', value: portfolioAnalytics?.risk?.riskRating || 'N/A', icon: Shield, change: '-2pts', trend: 'down' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-white dark:bg-gray-700 rounded-lg">
                <stat.icon size={20} className="text-corporate-blue" />
              </div>
              <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium mb-4">Retirement vs Purchase Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="retired" stroke="#0073e6" fill="#0073e6" fillOpacity={0.2} name="Retired" />
              <Area type="monotone" dataKey="purchased" stroke="#00d4aa" fill="#00d4aa" fillOpacity={0.2} name="Purchased" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div>
          <h3 className="font-medium mb-4">Average Price per Ton</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Price']} />
              <Line type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}