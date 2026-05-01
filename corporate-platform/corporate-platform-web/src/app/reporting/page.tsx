'use client'

import { useState } from 'react'
import { 
  FileText, 
  Download, 
  Send, 
  BarChart3, 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Globe,
  Target,
  TrendingUp,
  Eye,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  Printer,
  Share2,
  BookOpen,
  PieChart,
  Shield
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { useCSRD } from '@/hooks/useCSRD'
import { MaterialityAssessmentForm } from '@/components/csrd/MaterialityAssessmentForm'
import { DisclosureList } from '@/components/csrd/DisclosureList'
import { CSRDReportList } from '@/components/csrd/CSRDReportList'
import { CSRDReadinessCard } from '@/components/csrd/CSRDReadinessCard'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart
} from 'recharts'

export default function ReportingPage() {
  const { portfolio, retirements } = useCorporate()
  const [activeTab, setActiveTab] = useState<'esg' | 'carbon' | 'custom' | 'templates' | 'csrd'>('esg')
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [reportPeriod, setReportPeriod] = useState<'quarterly' | 'annual' | 'monthly'>('quarterly')

  // ESG metrics data
  const esgMetrics = [
    { category: 'Environmental', score: 87, target: 90, color: '#10b981' },
    { category: 'Social', score: 78, target: 85, color: '#3b82f6' },
    { category: 'Governance', score: 92, target: 88, color: '#8b5cf6' },
  ]

  // Carbon reduction timeline
  const reductionTimeline = [
    { year: '2022', emissions: 150000, target: 140000 },
    { year: '2023', emissions: 135000, target: 125000 },
    { year: '2024', emissions: 125000, target: 110000 },
    { year: '2025', target: 95000 },
  ]

  // Available reports
  const availableReports = [
    { 
      id: 'esg-2023', 
      name: 'ESG Sustainability Report', 
      type: 'Annual',
      period: '2023',
      status: 'published',
      lastGenerated: '2024-01-15',
      pages: 48,
      icon: FileText,
      frameworks: ['GRI', 'SASB', 'TCFD']
    },
    { 
      id: 'carbon-q4-2023', 
      name: 'Carbon Footprint Analysis', 
      type: 'Quarterly',
      period: 'Q4 2023',
      status: 'published',
      lastGenerated: '2024-01-10',
      pages: 32,
      icon: BarChart3,
      frameworks: ['GHG Protocol']
    },
    { 
      id: 'netzero-progress', 
      name: 'Net Zero Progress Report', 
      type: 'Quarterly',
      period: 'Q1 2024',
      status: 'draft',
      lastGenerated: '2024-03-18',
      pages: 28,
      icon: Target,
      frameworks: ['SBTi', 'SBTN']
    },
    { 
      id: 'sdg-impact-2023', 
      name: 'SDG Impact Assessment', 
      type: 'Annual',
      period: '2023',
      status: 'published',
      lastGenerated: '2024-02-28',
      pages: 36,
      icon: Globe,
      frameworks: ['UN SDGs']
    },
    { 
      id: 'compliance-q1-2024', 
      name: 'Regulatory Compliance Report', 
      type: 'Quarterly',
      period: 'Q1 2024',
      status: 'in-review',
      lastGenerated: '2024-03-20',
      pages: 42,
      icon: CheckCircle,
      frameworks: ['CSRD', 'SFDR']
    },
    { 
      id: 'stakeholder-2023', 
      name: 'Stakeholder Engagement Report', 
      type: 'Annual',
      period: '2023',
      status: 'published',
      lastGenerated: '2024-01-30',
      pages: 40,
      icon: Users,
      frameworks: ['GRI', 'AA1000']
    },
  ]

  // Report templates
  const reportTemplates = [
    { name: 'GHG Protocol Inventory', framework: 'GHG Protocol', duration: '30 min', icon: BarChart3 },
    { name: 'ESG Performance Dashboard', framework: 'Multiple', duration: '45 min', icon: PieChart },
    { name: 'Carbon Neutrality Statement', framework: 'ISO 14064', duration: '20 min', icon: Target },
    { name: 'Supply Chain Emissions', framework: 'Scope 3', duration: '60 min', icon: Globe },
    { name: 'Climate Risk Assessment', framework: 'TCFD', duration: '50 min', icon: AlertCircle },
    { name: 'Sustainability Disclosure', framework: 'SASB', duration: '40 min', icon: FileText },
  ]

  // Scheduled reports
  const scheduledReports = [
    { name: 'Q1 2024 ESG Report', schedule: 'Monthly', nextRun: '2024-04-01', recipients: 12, status: 'active' },
    { name: 'Carbon Monthly Update', schedule: 'Monthly', nextRun: '2024-04-05', recipients: 8, status: 'active' },
    { name: 'Board Sustainability', schedule: 'Quarterly', nextRun: '2024-04-15', recipients: 15, status: 'active' },
    { name: 'Investor ESG Briefing', schedule: 'Bi-Annual', nextRun: '2024-07-01', recipients: 25, status: 'paused' },
  ]

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'draft':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'in-review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'paused':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const {
    materiality: _csrdMateriality,
    materialityResult,
    assessing,
    assessError,
    disclosures,
    disclosuresLoading,
    disclosuresError,
    recording,
    recordError,
    reports: csrdReports,
    reportsLoading: csrdReportsLoading,
    reportsError: csrdReportsError,
    generating,
    generateError,
    lastGeneratedReport,
    readiness,
    readinessLoading,
    readinessError,
    assessMateriality,
    fetchDisclosures,
    recordDisclosure,
    generateReport,
    fetchReports,
    fetchReadiness,
    clearAssessError,
    clearRecordError,
    clearGenerateError,
  } = useCSRD(activeTab === 'csrd')

  // Calculate report statistics
  const totalReports = availableReports.length
  const publishedReports = availableReports.filter(r => r.status === 'published').length
  const avgPages = Math.round(availableReports.reduce((sum, r) => sum + r.pages, 0) / totalReports)

  return (
    <div className="space-y-6 animate-in">
      {/* Reporting Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Reporting & Analytics Hub
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Generate comprehensive sustainability reports, track ESG performance, and automate stakeholder communications.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Reports</div>
              <div className="text-2xl font-bold">{totalReports}</div>
              <div className="text-xs text-green-300">{publishedReports} published</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Automation Rate</div>
              <div className="text-2xl font-bold">84%</div>
              <div className="text-xs text-blue-300">Reports generated automatically</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="corporate-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'esg', label: 'ESG Analytics', icon: BarChart3 },
            { id: 'carbon', label: 'Carbon Reporting', icon: Target },
            { id: 'custom', label: 'Custom Reports', icon: FileText },
            { id: 'templates', label: 'Templates', icon: BookOpen },
            { id: 'csrd', label: 'CSRD Disclosures', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-corporate-blue text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={18} className="mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Period Selector */}
      <div className="corporate-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <Calendar className="text-corporate-blue mr-3" size={20} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Report Period</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Select reporting timeframe</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {['monthly', 'quarterly', 'annual'].map((period) => (
              <button
                key={period}
                onClick={() => setReportPeriod(period as any)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  reportPeriod === period
                    ? 'bg-corporate-blue text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ESG Analytics Tab */}
      {activeTab === 'esg' && (
        <div className="space-y-6">
          {/* ESG Score Dashboard */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">ESG Performance Dashboard</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Overall ESG score and category performance</p>
              </div>
              <div className="flex items-center">
                <div className="text-2xl font-bold text-corporate-blue mr-2">85.7</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">/100 Overall Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {esgMetrics.map((metric) => (
                <div key={metric.category} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-medium text-gray-900 dark:text-white">{metric.category}</div>
                    <div className="flex items-center">
                      <div className="text-2xl font-bold mr-2" style={{ color: metric.color }}>
                        {metric.score}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">/100</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${metric.score}%`, backgroundColor: metric.color }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="text-gray-600 dark:text-gray-400">Current: {metric.score}</div>
                    <div className="text-gray-600 dark:text-gray-400">Target: {metric.target}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Performance Trend */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Performance Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={[
                    { month: 'Oct', environmental: 82, social: 72, governance: 88 },
                    { month: 'Nov', environmental: 84, social: 75, governance: 89 },
                    { month: 'Dec', environmental: 85, social: 76, governance: 90 },
                    { month: 'Jan', environmental: 86, social: 77, governance: 91 },
                    { month: 'Feb', environmental: 87, social: 77, governance: 91 },
                    { month: 'Mar', environmental: 87, social: 78, governance: 92 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[60, 100]} />
                    <Tooltip 
                      formatter={(value: any) => [`${value}/100`, 'Score']}
                    />
                    <Bar dataKey="social" fill="#3b82f6" name="Social" barSize={20} />
                    <Line type="monotone" dataKey="environmental" stroke="#10b981" strokeWidth={2} name="Environmental" />
                    <Line type="monotone" dataKey="governance" stroke="#8b5cf6" strokeWidth={2} name="Governance" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Report Generation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="corporate-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate ESG Report</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create a new ESG performance report</p>
                </div>
                <RefreshCw className="text-corporate-blue" size={20} />
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Report Type
                  </label>
                  <select className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue">
                    <option>Comprehensive ESG Report</option>
                    <option>Executive Summary</option>
                    <option>Investor Briefing</option>
                    <option>Stakeholder Update</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Time Period
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Q1 2024', 'Q2 2024', '2023 Annual', 'Custom Range'].map((period) => (
                      <button
                        key={period}
                        className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Include Frameworks
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['GRI', 'SASB', 'TCFD', 'UN SDGs', 'CDP'].map((framework) => (
                      <label key={framework} className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue" />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{framework}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <button className="w-full corporate-btn-primary py-3 mt-4">
                  <FileText size={18} className="mr-2" />
                  Generate Report
                </button>
              </div>
            </div>

            <div className="corporate-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Scheduled Reports</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Automated report delivery</p>
                </div>
                <Clock className="text-corporate-blue" size={20} />
              </div>
              
              <div className="space-y-4">
                {scheduledReports.map((report) => (
                  <div key={report.name} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900 dark:text-white">{report.name}</div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Schedule</div>
                        <div className="font-medium">{report.schedule}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Next Run</div>
                        <div className="font-medium">{new Date(report.nextRun).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Recipients</div>
                        <div className="font-medium">{report.recipients}</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button className="w-full corporate-btn-secondary py-2 mt-2">
                  Manage Schedule
                  <ChevronRight size={16} className="ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carbon Reporting Tab */}
      {activeTab === 'carbon' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Carbon Reduction Progress</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Emissions reduction trajectory vs. targets</p>
              </div>
              <Target className="text-corporate-blue" size={24} />
            </div>
            
            <div className="h-72 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={reductionTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" />
                  <YAxis label={{ value: 'tCO₂e', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: any) => [`${value?.toLocaleString() ?? '0'} tCO₂e`, 'Emissions']}
                  />
                  <Bar dataKey="emissions" fill="#0073e6" name="Actual Emissions" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="target" stroke="#00d4aa" strokeWidth={3} strokeDasharray="5 5" name="Target" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                <div className="text-2xl font-bold text-corporate-blue mb-1">16.7%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Reduction since 2022</div>
              </div>
              <div className="p-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">On Track</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Net Zero 2030 target</div>
              </div>
              <div className="p-4 bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">{portfolio.totalRetired.toLocaleString()}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">tCO₂ retired to date</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Reports Grid */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Available Reports</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Generated and draft reports ready for distribution</p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="corporate-btn-secondary px-4 py-2">
              <Filter size={16} className="mr-2" />
              Filter
            </button>
            <button className="corporate-btn-primary px-4 py-2">
              <Send size={16} className="mr-2" />
              Share All
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableReports.map((report) => {
            const Icon = report.icon
            return (
              <div 
                key={report.id} 
                className={`corporate-card p-5 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                  selectedReport === report.id ? 'ring-2 ring-corporate-blue' : ''
                }`}
                onClick={() => setSelectedReport(report.id === selectedReport ? null : report.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Icon className="text-corporate-blue" size={20} />
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status.replace('-', ' ')}
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{report.name}</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {report.type} • {report.period} • {report.pages} pages
                </div>
                
                <div className="flex flex-wrap gap-1 mb-4">
                  {report.frameworks.map((framework) => (
                    <span key={framework} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">
                      {framework}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <div className="flex items-center">
                    <Calendar size={12} className="mr-1" />
                    {new Date(report.lastGenerated).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Eye size={12} className="mr-1" />
                    Viewed 24 times
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button className="corporate-btn-secondary text-sm px-3 py-2">
                    <Eye size={14} className="mr-1" />
                    Preview
                  </button>
                  <button className="corporate-btn-primary text-sm px-3 py-2">
                    <Download size={14} className="mr-1" />
                    Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Report Stats */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-corporate-blue">{totalReports}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Reports</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-corporate-blue">{avgPages}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Pages</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-corporate-blue">6</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Frameworks</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-2xl font-bold text-corporate-blue">84%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Automation Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Templates */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Report Templates</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pre-built templates for common reporting needs</p>
          </div>
          <BookOpen className="text-corporate-blue" size={24} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTemplates.map((template, index) => {
            const Icon = template.icon
            return (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-corporate-blue/50 hover:shadow-md transition-all duration-300">
                <div className="flex items-start mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                    <Icon className="text-corporate-blue" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{template.framework}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <Clock size={12} className="inline mr-1" />
                    {template.duration}
                  </div>
                  <button className="text-sm text-corporate-blue hover:text-corporate-blue/80">
                    Use Template
                    <ChevronRight size={12} className="ml-1" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Distribution & Sharing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="corporate-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Distribution Channels</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Share reports with stakeholders</p>
            </div>
            <Share2 className="text-corporate-blue" size={24} />
          </div>
          
          <div className="space-y-4">
            {[
              { channel: 'Email', icon: Send, recipients: 45, status: 'active' },
              { channel: 'Investor Portal', icon: ExternalLink, recipients: 120, status: 'active' },
              { channel: 'Annual Report', icon: FileText, recipients: 5000, status: 'scheduled' },
              { channel: 'Regulatory Portal', icon: Globe, recipients: 3, status: 'active' },
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                      <Icon className="text-corporate-blue" size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.channel}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{item.recipients} recipients</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {item.status}
                  </div>
                </div>
              )
            })}
            
            <button className="w-full corporate-btn-primary py-3 mt-4">
              <Send size={18} className="mr-2" />
              Configure Distribution
            </button>
          </div>
        </div>

        <div className="corporate-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export Options</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multiple formats for different needs</p>
            </div>
            <Download className="text-corporate-blue" size={24} />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { format: 'PDF', icon: FileText, color: 'bg-red-500', description: 'Print-ready documents' },
              { format: 'Excel', icon: BarChart3, color: 'bg-green-500', description: 'Data analysis' },
              { format: 'PowerPoint', icon: TrendingUp, color: 'bg-orange-500', description: 'Presentations' },
              { format: 'JSON', icon: BookOpen, color: 'bg-purple-500', description: 'API integration' },
              { format: 'CSV', icon: Filter, color: 'bg-blue-500', description: 'Raw data export' },
              { format: 'HTML', icon: Globe, color: 'bg-pink-500', description: 'Web publishing' },
            ].map((item, index) => (
              <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                <div className={`${item.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3`}>
                  <item.icon className="text-white" size={24} />
                </div>
                <div className="font-medium text-gray-900 dark:text-white mb-1">{item.format}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSRD Disclosures Tab */}
      {activeTab === 'csrd' && (
        <div className="space-y-6">
          {/* Readiness Card */}
          <CSRDReadinessCard
            readiness={readiness}
            loading={readinessLoading}
            error={readinessError}
            onRefresh={fetchReadiness}
          />

          {/* Materiality Assessment */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Double Materiality Assessment
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Identify and score material sustainability topics per ESRS 2
                </p>
              </div>
              {materialityResult && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-corporate-blue">
                    {materialityResult.materialTopics.length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    material topics
                  </div>
                </div>
              )}
            </div>
            <MaterialityAssessmentForm
              onAssess={assessMateriality}
              assessing={assessing}
              assessError={assessError}
              onClearError={clearAssessError}
            />
          </div>

          {/* ESRS Disclosures */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  ESRS Disclosures
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Record and review data points across all ESRS standards
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-corporate-blue">
                  {disclosures.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  recorded
                </div>
              </div>
            </div>
            <DisclosureList
              disclosures={disclosures}
              loading={disclosuresLoading}
              error={disclosuresError}
              recording={recording}
              recordError={recordError}
              onFetch={fetchDisclosures}
              onRecord={recordDisclosure}
              onClearRecordError={clearRecordError}
            />
          </div>

          {/* Reports */}
          <CSRDReportList
            reports={csrdReports}
            loading={csrdReportsLoading}
            error={csrdReportsError}
            generating={generating}
            generateError={generateError}
            lastGeneratedReport={lastGeneratedReport}
            onGenerate={generateReport}
            onFetchReports={fetchReports}
            onClearGenerateError={clearGenerateError}
          />
        </div>
      )}
    </div>
  )
}