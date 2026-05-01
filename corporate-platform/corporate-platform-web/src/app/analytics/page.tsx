'use client'

import { useState } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Globe, 
  Target,
  Filter,
  Download,
  Calendar,
  PieChart,
  LineChart,
  MapPin,
  Shield,
  Users,
  Leaf,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import RetirementAnalyticsDashboard from '@/components/analytics/RetirementAnalyticsDashboard'
import { 
  LineChart as RechartsLineChart, 
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'

export default function AnalyticsPage() {
  const { portfolio, credits, retirements } = useCorporate()
  const [timeRange, setTimeRange] = useState<'1y' | '2y' | '3y' | 'all'>('1y')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState('price')

  // Performance over time data
  const performanceData = [
    { month: 'Jul', price: 16.5, volume: 12000, score: 85 },
    { month: 'Aug', price: 17.2, volume: 14500, score: 87 },
    { month: 'Sep', price: 16.8, volume: 13000, score: 86 },
    { month: 'Oct', price: 18.1, volume: 16000, score: 88 },
    { month: 'Nov', price: 19.3, volume: 18000, score: 89 },
    { month: 'Dec', price: 18.7, volume: 17500, score: 90 },
    { month: 'Jan', price: 19.5, volume: 19000, score: 91 },
    { month: 'Feb', price: 19.2, volume: 18500, score: 90 },
    { month: 'Mar', price: 18.8, volume: 17000, score: 89 },
    { month: 'Apr', price: 19.0, volume: 17500, score: 90 },
    { month: 'May', price: 19.8, volume: 20000, score: 92 },
    { month: 'Jun', price: 20.1, volume: 21000, score: 93 },
  ]

  // Credit quality radar data
  const creditQualityData = [
    { subject: 'Verification', A: 95, fullMark: 100 },
    { subject: 'Additionality', A: 88, fullMark: 100 },
    { subject: 'Permanence', A: 92, fullMark: 100 },
    { subject: 'Leakage', A: 85, fullMark: 100 },
    { subject: 'Co-benefits', A: 90, fullMark: 100 },
    { subject: 'Transparency', A: 94, fullMark: 100 },
  ]

  // Project comparison scatter data
  const projectComparisonData = credits.map(credit => ({
    name: credit.projectName.substring(0, 20) + '...',
    price: credit.pricePerTon,
    score: credit.dynamicScore,
    volume: credit.availableAmount / 1000,
    country: credit.country,
  }))

  // SDG contribution data
  const sdgContributionData = [
    { sdg: 13, name: 'Climate Action', credits: 45000, percentage: 45 },
    { sdg: 15, name: 'Life on Land', credits: 28000, percentage: 28 },
    { sdg: 7, name: 'Affordable Energy', credits: 15000, percentage: 15 },
    { sdg: 8, name: 'Decent Work', credits: 12000, percentage: 12 },
  ]

  // Regional performance
  const regionalPerformance = [
    { region: 'South America', credits: 36000, price: 19.5, growth: 12.5, risk: 'Low' },
    { region: 'Asia', credits: 27000, price: 16.8, growth: 8.2, risk: 'Medium' },
    { region: 'Africa', credits: 19500, price: 17.2, growth: 15.3, risk: 'Medium' },
    { region: 'North America', credits: 9000, price: 24.9, growth: 5.7, risk: 'Low' },
    { region: 'Europe', credits: 8500, price: 22.3, growth: 6.8, risk: 'Low' },
  ]

  // Key metrics
  const keyMetrics = [
    { label: 'Portfolio Alpha', value: '+2.3%', description: 'Outperformance vs market', trend: 'up', icon: TrendingUp },
    { label: 'Risk-Adjusted Return', value: '1.42', description: 'Sharpe Ratio', trend: 'up', icon: BarChart3 },
    { label: 'Price Volatility', value: '8.2%', description: 'Annualized volatility', trend: 'down', icon: TrendingDown },
    { label: 'Diversification Score', value: '84/100', description: 'Portfolio diversification', trend: 'up', icon: PieChart },
  ]

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Analytics Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Advanced Analytics
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Deep insights, predictive analytics, and comprehensive performance metrics for your carbon credit portfolio.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Analytics Score</div>
              <div className="text-2xl font-bold">87.5/100</div>
              <div className="text-xs text-green-300">Above industry average</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Data Points</div>
              <div className="text-2xl font-bold">1,248</div>
              <div className="text-xs text-blue-300">Real-time metrics</div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="corporate-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <Calendar className="text-corporate-blue mr-3" size={20} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Time Range</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Select period for analysis</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {['1y', '2y', '3y', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  timeRange === range
                    ? 'bg-corporate-blue text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {range === '1y' ? '1 Year' : 
                 range === '2y' ? '2 Years' : 
                 range === '3y' ? '3 Years' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Performance Metrics */}
      <RetirementAnalyticsDashboard />

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="corporate-card p-5 hover:scale-[1.02] transition-transform duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Icon className="text-corporate-blue" size={20} />
                </div>
                <span className={`text-sm font-medium flex items-center ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {metric.value}
                </span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white mb-1">{metric.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{metric.description}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Over Time */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Performance Over Time</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Price, volume, and quality trends</p>
              </div>
              <div className="flex items-center space-x-2">
                {['price', 'volume', 'score'].map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedMetric === metric
                        ? 'bg-corporate-blue text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: any) => {
                      if (selectedMetric === 'price') return [`$${value}`, 'Price per ton']
                      if (selectedMetric === 'volume') return [`${value?.toLocaleString() ?? '0'} tCO₂`, 'Volume']
                      return [`${value}`, 'Quality Score']
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey={selectedMetric}
                    stroke="#0073e6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="score"
                    stroke="#00d4aa"
                    strokeWidth={2}
                    strokeOpacity={selectedMetric === 'score' ? 1 : 0.3}
                    dot={false}
                    name="Quality Score"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Comparison */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Project Comparison</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Price vs. quality analysis</p>
              </div>
              <Filter className="text-corporate-blue" size={20} />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    dataKey="price" 
                    name="Price" 
                    unit="$" 
                    domain={[10, 30]}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="score" 
                    name="Quality Score" 
                    domain={[80, 100]}
                  />
                  <ZAxis type="number" dataKey="volume" range={[100, 500]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value: any, name: string | unknown) => {
                      if (name === 'price') return [`$${value}`, 'Price per ton']
                      if (name === 'score') return [value, 'Quality Score']
                      return [`${value}K tCO₂`, 'Volume']
                    }}
                    labelFormatter={(label) => `Project: ${label}`}
                  />
                  <Scatter
                    name="Projects"
                    data={projectComparisonData}
                    fill="#0073e6"
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-lg font-bold text-corporate-blue">
                  ${(projectComparisonData.reduce((sum, p) => sum + p.price, 0) / projectComparisonData.length).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Price</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-lg font-bold text-corporate-blue">
                  {(projectComparisonData.reduce((sum, p) => sum + p.score, 0) / projectComparisonData.length).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Score</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-lg font-bold text-corporate-blue">
                  {projectComparisonData.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Projects</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Insights & Details */}
        <div className="space-y-6">
          {/* Credit Quality Radar */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Credit Quality Analysis</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive quality metrics</p>
              </div>
              <Shield className="text-corporate-blue" size={20} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={creditQualityData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Portfolio"
                    dataKey="A"
                    stroke="#0073e6"
                    fill="#0073e6"
                    fillOpacity={0.6}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value}/100`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-linear-to-r from-corporate-blue/10 to-corporate-teal/10 rounded-full">
                <Target size={16} className="mr-2 text-corporate-blue" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Overall Quality Score: 90.7/100
                </span>
              </div>
            </div>
          </div>

          {/* SDG Impact Analysis */}
          <div className="corporate-card p-6">
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('sdg')}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">SDG Impact Analysis</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sustainable Development Goals contribution</p>
                </div>
                <Globe className="text-corporate-blue" size={20} />
              </div>
            </div>
            
            {expandedSection === 'sdg' && (
              <div className="space-y-4 animate-in">
                {sdgContributionData.map((sdg) => (
                  <div key={sdg.sdg}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-lg flex items-center justify-center mr-2">
                          <span className="font-bold">{sdg.sdg}</span>
                        </div>
                        <span className="text-gray-900 dark:text-white">{sdg.name}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">{sdg.percentage}%</div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-blue-500 to-teal-500"
                        style={{ width: `${sdg.percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {sdg.credits.toLocaleString()} tCO₂
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Regional Performance */}
          <div className="corporate-card p-6">
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('regional')}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Regional Performance</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Breakdown by geographic region</p>
                </div>
                <MapPin className="text-corporate-blue" size={20} />
              </div>
            </div>
            
            {expandedSection === 'regional' && (
              <div className="space-y-3 animate-in">
                {regionalPerformance.map((region) => (
                  <div key={region.region} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-gray-900 dark:text-white">{region.region}</div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        region.risk === 'Low' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {region.risk} Risk
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Credits</div>
                        <div className="font-medium">{region.credits.toLocaleString()} tCO₂</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Price</div>
                        <div className="font-medium">${region.price}/ton</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Growth</div>
                        <div className={`font-medium ${region.growth > 10 ? 'text-green-600' : 'text-blue-600'}`}>
                          {region.growth}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Predictive Insights */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Predictive Insights</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered forecasts</p>
              </div>
              <Zap className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center text-sm text-blue-800 dark:text-blue-300 mb-2">
                  <TrendingUp size={16} className="mr-2" />
                  <span className="font-medium">Price Forecast</span>
                </div>
                <div className="text-xs text-blue-700/80 dark:text-blue-400/80">
                  Expected to increase by 8-12% over next quarter based on market trends and policy developments.
                </div>
              </div>
              <div className="p-3 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center text-sm text-green-800 dark:text-green-300 mb-2">
                  <Leaf size={16} className="mr-2" />
                  <span className="font-medium">Demand Alert</span>
                </div>
                <div className="text-xs text-green-700/80 dark:text-green-400/80">
                  Corporate demand for nature-based solutions expected to grow 25% in Q3 2024.
                </div>
              </div>
              <div className="p-3 bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center text-sm text-orange-800 dark:text-orange-300 mb-2">
                  <AlertCircle size={16} className="mr-2" />
                  <span className="font-medium">Risk Warning</span>
                </div>
                <div className="text-xs text-orange-700/80 dark:text-orange-400/80">
                  Monitor regulatory changes in European carbon markets that may impact pricing.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <Download className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">Export Full Report</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">PDF, Excel, or JSON formats</div>
            </div>
          </div>
        </button>
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <Users className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">Share Dashboard</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Team or external stakeholders</div>
            </div>
          </div>
        </button>
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <LineChart className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">Schedule Report</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Automated weekly or monthly</div>
            </div>
          </div>
        </button>
      </div>

      {/* Data Sources Info */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Data Sources & Methodology</h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">Updated hourly</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            <div className="font-medium text-gray-900 dark:text-white mb-1">Market Data</div>
            <div>Real-time pricing from multiple exchanges</div>
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            <div className="font-medium text-gray-900 dark:text-white mb-1">Satellite Imagery</div>
            <div>ESA Sentinel, NASA, Planet Labs</div>
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            <div className="font-medium text-gray-900 dark:text-white mb-1">IoT Sensors</div>
            <div>Ground truth validation networks</div>
          </div>
        </div>
      </div>
    </div>
  )
}