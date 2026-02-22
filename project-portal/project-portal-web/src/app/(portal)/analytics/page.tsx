// File: src/app/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Filter,
  Download,
  Eye,
  RefreshCw,
  PieChart,
  LineChart,
  Map,
  Globe,
  TreePine,
  Coins,
  Users,
  Droplets,
  Leaf
} from 'lucide-react';

// Mock analytics data
const monthlyData = [
  { month: 'Jan', carbon: 120, revenue: 1200, trees: 850 },
  { month: 'Feb', carbon: 180, revenue: 1800, trees: 920 },
  { month: 'Mar', carbon: 220, revenue: 2200, trees: 1050 },
  { month: 'Apr', carbon: 280, revenue: 2800, trees: 1240 },
  { month: 'May', carbon: 320, revenue: 3200, trees: 1380 },
  { month: 'Jun', carbon: 380, revenue: 3800, trees: 1560 },
  { month: 'Jul', carbon: 420, revenue: 4200, trees: 1680 },
  { month: 'Aug', carbon: 450, revenue: 4500, trees: 1850 },
  { month: 'Sep', carbon: 480, revenue: 4800, trees: 1950 },
  { month: 'Oct', carbon: 520, revenue: 5200, trees: 2100 },
  { month: 'Nov', carbon: 580, revenue: 5800, trees: 2250 },
  { month: 'Dec', carbon: 620, revenue: 6200, trees: 2450 },
];

const projectPerformance = [
  { name: 'Amazon Rainforest', carbon: 450, efficiency: 92, revenue: 2250, trend: 'up' },
  { name: 'Kenyan Agroforestry', carbon: 320, efficiency: 85, revenue: 1600, trend: 'up' },
  { name: 'Mangrove Conservation', carbon: 580, efficiency: 78, revenue: 2900, trend: 'stable' },
  { name: 'Soil Carbon Project', carbon: 210, efficiency: 65, revenue: 1050, trend: 'up' },
  { name: 'Ethiopian REDD+', carbon: 890, efficiency: 88, revenue: 4450, trend: 'down' },
];

const regionalDistribution = [
  { region: 'South America', percentage: 35, color: 'bg-emerald-500' },
  { region: 'Africa', percentage: 28, color: 'bg-teal-500' },
  { region: 'Asia', percentage: 22, color: 'bg-cyan-500' },
  { region: 'North America', percentage: 12, color: 'bg-blue-500' },
  { region: 'Europe', percentage: 3, color: 'bg-purple-500' },
];

const kpiCards = [
  { title: 'Total Carbon Sequestered', value: '2,480 tCO₂', change: '+18%', icon: TreePine, color: 'from-emerald-500 to-green-500' },
  { title: 'Total Revenue Generated', value: '$24,800', change: '+22%', icon: Coins, color: 'from-amber-500 to-orange-500' },
  { title: 'Farmers Engaged', value: '127', change: '+15%', icon: Users, color: 'from-blue-500 to-cyan-500' },
  { title: 'Water Conservation', value: '2.4M L', change: '+32%', icon: Droplets, color: 'from-cyan-500 to-teal-500' },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('year');
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('carbon');
  const [viewMode, setViewMode] = useState('charts');

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const getMetricColor = (metric: string) => {
    switch(metric) {
      case 'carbon': return 'text-emerald-600';
      case 'revenue': return 'text-amber-600';
      case 'trees': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getMetricLabel = (metric: string) => {
    switch(metric) {
      case 'carbon': return 'Carbon Sequestered (tCO₂)';
      case 'revenue': return 'Revenue ($)';
      case 'trees': return 'Trees Planted';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-cyan-500 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <BarChart3 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
                <p className="text-cyan-100 mt-2">Deep insights into your carbon projects' performance</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <button
              onClick={refreshData}
              disabled={loading}
              className="px-4 py-2 bg-white/20 rounded-lg font-medium hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button className="px-6 py-3 bg-white text-cyan-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
              <Download className="w-5 h-5 mr-2" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-600 mr-2" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="quarter">Last quarter</option>
                <option value="year">Last year</option>
                <option value="all">All time</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="carbon">Carbon Sequestered</option>
                <option value="revenue">Revenue</option>
                <option value="trees">Trees Planted</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode('charts')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'charts' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LineChart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'map' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Map className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'table' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-linear-to-r ${kpi.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center text-emerald-600">
                  {kpi.change.startsWith('+') ? (
                    <TrendingUp className="w-5 h-5 mr-1" />
                  ) : (
                    <TrendingDown className="w-5 h-5 mr-1" />
                  )}
                  <span className="font-medium">{kpi.change}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.title}</div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time Series Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Performance Over Time</h3>
                <p className="text-gray-600">{getMetricLabel(selectedMetric)}</p>
              </div>
              <div className={`px-3 py-1 rounded-full ${getMetricColor(selectedMetric)} bg-opacity-10 font-medium`}>
                {timeRange === 'year' ? 'Last 12 months' : timeRange}
              </div>
            </div>
            
            {/* Simple Bar Chart Visualization */}
            <div className="h-64 flex items-end justify-between space-x-2 pt-8">
              {monthlyData.map((data, index) => {
                const value = data[selectedMetric as keyof typeof data] as number;
                const maxValue = Math.max(...monthlyData.map(d => d[selectedMetric as keyof typeof d] as number));
                const height = (value / maxValue) * 100;
                
                return (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        selectedMetric === 'carbon' ? 'bg-linear-to-t from-emerald-400 to-emerald-500' :
                        selectedMetric === 'revenue' ? 'bg-linear-to-t from-amber-400 to-amber-500' :
                        'bg-linear-to-t from-blue-400 to-blue-500'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-sm text-gray-600 mt-2">{data.month}</div>
                    <div className="text-xs font-medium text-gray-900 mt-1">{value}</div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-6">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Carbon Sequestered</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Revenue</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Trees Planted</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Performance Table */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Project Performance Ranking</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Project</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Carbon (tCO₂)</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Efficiency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Revenue</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPerformance.map((project, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">{project.name}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">{project.carbon}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden mr-3">
                            <div 
                              className={`h-full ${
                                project.efficiency >= 80 ? 'bg-emerald-500' :
                                project.efficiency >= 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${project.efficiency}%` }}
                            ></div>
                          </div>
                          <span className="font-medium text-gray-900">{project.efficiency}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">${project.revenue}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {project.trend === 'up' ? (
                            <>
                              <TrendingUp className="w-5 h-5 text-emerald-600 mr-1" />
                              <span className="text-emerald-600 font-medium">Up</span>
                            </>
                          ) : project.trend === 'down' ? (
                            <>
                              <TrendingDown className="w-5 h-5 text-red-600 mr-1" />
                              <span className="text-red-600 font-medium">Down</span>
                            </>
                          ) : (
                            <span className="text-gray-600 font-medium">Stable</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Insights */}
        <div className="space-y-6">
          {/* Regional Distribution */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Regional Distribution</h3>
              <Globe className="w-6 h-6 text-gray-600" />
            </div>
            
            <div className="space-y-4">
              {regionalDistribution.map((region, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-900">{region.region}</span>
                    <span className="text-gray-700">{region.percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${region.color} rounded-full transition-all duration-1000`}
                      style={{ width: `${region.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center">
                <Leaf className="w-5 h-5 text-emerald-600 mr-3" />
                <div>
                  <div className="font-medium text-emerald-800">Insight</div>
                  <div className="text-sm text-emerald-700">
                    South America leads with 35% of total carbon sequestration.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <h3 className="text-xl font-bold mb-6">Efficiency Metrics</h3>
            
            <div className="space-y-6">
              {[
                { label: 'Carbon per Hectare', value: '24.8 tCO₂/ha', benchmark: '18.5', status: 'above' },
                { label: 'Revenue per Credit', value: '$12.40', benchmark: '$10.80', status: 'above' },
                { label: 'Farmer Engagement', value: '94%', benchmark: '85%', status: 'above' },
                { label: 'Verification Success', value: '98%', benchmark: '92%', status: 'above' },
              ].map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{metric.label}</span>
                    <div className="flex items-center">
                      <span className="font-bold text-lg">{metric.value}</span>
                      {metric.status === 'above' ? (
                        <TrendingUp className="w-4 h-4 ml-2 text-emerald-200" />
                      ) : (
                        <TrendingDown className="w-4 h-4 ml-2 text-amber-200" />
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-emerald-200">
                    Benchmark: {metric.benchmark} • {metric.status === 'above' ? 'Above target' : 'Below target'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Avg. Project Size', value: '9.8 ha' },
                { label: 'Credits per Month', value: '210 tCO₂' },
                { label: 'New Farmers/Month', value: '8' },
                { label: 'Verification Time', value: '14 days' },
              ].map((stat, index) => (
                <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
              View Detailed Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}