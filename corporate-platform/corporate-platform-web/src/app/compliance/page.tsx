'use client'

import { useState, useEffect } from 'react'
import { 
  Shield, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Download,
  Clock,
  TrendingUp,
  Globe,
  Building,
  Users,
  Target,
  Award,
  ExternalLink,
  ChevronRight,
  Eye,
  Send,
  Bell,
  Loader
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { useCompliance } from '@/hooks/useCompliance'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import { ComplianceFramework } from '@/types'

export default function CompliancePage() {
  const { portfolio, retirements } = useCorporate()
  const compliance = useCompliance()
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'frameworks' | 'audit'>('overview')
  const [expandedRequirement, setExpandedRequirement] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string>('company-1') // Get from context/auth in production

  // Load compliance data on mount
  useEffect(() => {
    if (companyId) {
      compliance.getAllStatuses()
      compliance.getComplianceReport(companyId)
    }
  }, [companyId])

  // Compliance frameworks
  const frameworks = [
    { 
      id: 'ghg', 
      name: 'GHG Protocol', 
      status: 'compliant', 
      lastUpdated: '2024-03-15',
      requirements: 12,
      completed: 12,
      icon: Shield,
      color: 'bg-green-500',
      description: 'Global standard for greenhouse gas accounting'
    },
    { 
      id: 'csrd', 
      name: 'CSRD (EU)', 
      status: 'in-progress', 
      lastUpdated: '2024-03-10',
      requirements: 18,
      completed: 15,
      icon: FileText,
      color: 'bg-blue-500',
      description: 'Corporate Sustainability Reporting Directive'
    },
    { 
      id: 'sbti', 
      name: 'SBTi', 
      status: 'approved', 
      lastUpdated: '2024-02-28',
      requirements: 8,
      completed: 8,
      icon: Target,
      color: 'bg-purple-500',
      description: 'Science Based Targets initiative'
    },
    { 
      id: 'corsia', 
      name: 'CORSIA', 
      status: 'compliant', 
      lastUpdated: '2024-03-01',
      requirements: 6,
      completed: 6,
      icon: Globe,
      color: 'bg-orange-500',
      description: 'Carbon Offsetting & Reduction Scheme for International Aviation'
    },
    { 
      id: 'cbam', 
      name: 'CBAM (EU)', 
      status: 'pending', 
      lastUpdated: '2024-02-15',
      requirements: 10,
      completed: 4,
      icon: Building,
      color: 'bg-yellow-500',
      description: 'Carbon Border Adjustment Mechanism'
    },
    { 
      id: 'tcfd', 
      name: 'TCFD', 
      status: 'compliant', 
      lastUpdated: '2024-03-05',
      requirements: 11,
      completed: 11,
      icon: Award,
      color: 'bg-teal-500',
      description: 'Task Force on Climate-related Financial Disclosures'
    },
  ]

  // Compliance requirements
  const requirements = [
    { 
      id: 'req-001', 
      framework: 'GHG Protocol', 
      title: 'Scope 1 & 2 Emissions Inventory', 
      description: 'Complete annual inventory of direct and energy indirect emissions',
      dueDate: '2024-03-31',
      status: 'completed',
      priority: 'high'
    },
    { 
      id: 'req-002', 
      framework: 'CSRD', 
      title: 'Double Materiality Assessment', 
      description: 'Assess impact of sustainability matters on company and vice versa',
      dueDate: '2024-04-15',
      status: 'in-progress',
      priority: 'critical'
    },
    { 
      id: 'req-003', 
      framework: 'SBTi', 
      title: 'Target Validation Report', 
      description: 'Submit science-based targets for validation',
      dueDate: '2024-05-30',
      status: 'pending',
      priority: 'high'
    },
    { 
      id: 'req-004', 
      framework: 'CORSIA', 
      title: 'Aviation Emissions Report', 
      description: 'Report emissions from international flights',
      dueDate: '2024-03-31',
      status: 'completed',
      priority: 'medium'
    },
    { 
      id: 'req-005', 
      framework: 'CBAM', 
      title: 'Import Emissions Declaration', 
      description: 'Declare embedded emissions in imported goods',
      dueDate: '2024-10-31',
      status: 'not-started',
      priority: 'medium'
    },
  ]

  // Compliance metrics data
  const complianceMetrics = [
    { month: 'Jan', compliance: 85, reports: 3 },
    { month: 'Feb', compliance: 88, reports: 4 },
    { month: 'Mar', compliance: 92, reports: 6 },
    { month: 'Apr', compliance: 90, reports: 5 },
    { month: 'May', compliance: 93, reports: 7 },
    { month: 'Jun', compliance: 95, reports: 8 },
  ]

  // Regulatory updates
  const regulatoryUpdates = [
    { 
      title: 'EU Adopts New CSRD Implementation Rules',
      date: '2024-03-18',
      impact: 'high',
      description: 'New technical standards for sustainability reporting adopted',
      action: 'Review new requirements'
    },
    { 
      title: 'SEC Climate Disclosure Rules Finalized',
      date: '2024-03-06',
      impact: 'medium',
      description: 'Public companies must disclose climate-related risks',
      action: 'Update disclosure templates'
    },
    { 
      title: 'UK Transition to UK ETS Complete',
      date: '2024-02-28',
      impact: 'low',
      description: 'Full transition from EU ETS to UK Emissions Trading Scheme',
      action: 'Verify UK ETS compliance'
    },
  ]

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'compliant':
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'not-started':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Compliance Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Compliance & Regulatory Hub
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Track regulatory requirements, generate reports, and ensure compliance across all frameworks.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Overall Compliance</div>
              <div className="text-2xl font-bold">94%</div>
              <div className="text-xs text-green-300 flex items-center">
                <TrendingUp size={12} className="mr-1" />
                +6% this quarter
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Active Frameworks</div>
              <div className="text-2xl font-bold">{frameworks.length}</div>
              <div className="text-xs text-blue-300">Regulatory frameworks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="corporate-card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'reports', label: 'Reports', icon: FileText },
            { id: 'frameworks', label: 'Frameworks', icon: Target },
            { id: 'audit', label: 'Audit Trail', icon: Eye },
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="corporate-card p-5">
              <div className="flex items-center justify-between mb-4">
                <Shield className="text-green-500" size={24} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">94%</span>
              </div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">Compliance Score</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Overall compliance rate</div>
            </div>
            <div className="corporate-card p-5">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="text-blue-500" size={24} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">42</span>
              </div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">Requirements Met</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Out of 48 total</div>
            </div>
            <div className="corporate-card p-5">
              <div className="flex items-center justify-between mb-4">
                <Clock className="text-orange-500" size={24} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">3</span>
              </div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">Pending Deadlines</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Next 30 days</div>
            </div>
            <div className="corporate-card p-5">
              <div className="flex items-center justify-between mb-4">
                <AlertCircle className="text-red-500" size={24} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">1</span>
              </div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">Critical Issues</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Requiring attention</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Compliance Trend */}
            <div className="lg:col-span-2">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Compliance Trend</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Monthly compliance score and report volume</p>
                  </div>
                  <TrendingUp className="text-corporate-blue" size={20} />
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complianceMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'compliance') return [`${value}%`, 'Compliance Score']
                          return [value, 'Reports Submitted']
                        }}
                      />
                      <Bar yAxisId="left" dataKey="compliance" fill="#0073e6" name="Compliance Score" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="reports" fill="#00d4aa" name="Reports Submitted" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Column - Upcoming Deadlines */}
            <div>
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Deadlines</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Critical compliance dates</p>
                  </div>
                  <Calendar className="text-corporate-blue" size={20} />
                </div>
                <div className="space-y-4">
                  {requirements
                    .filter(req => req.status !== 'completed')
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                    .slice(0, 3)
                    .map((req) => (
                      <div key={req.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium text-gray-900 dark:text-white">{req.title}</div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                            {req.status.replace('-', ' ')}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-600 dark:text-gray-400">{req.framework}</div>
                          <div className="flex items-center">
                            <Calendar size={12} className="mr-1" />
                            <span className="font-medium">{new Date(req.dueDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center mt-2">
                          <div className={`w-2 h-2 rounded-full mr-2 ${getPriorityColor(req.priority)}`}></div>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Priority: <span className="font-medium">{req.priority}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
                <button className="w-full mt-4 corporate-btn-secondary py-2">
                  View All Deadlines
                  <ChevronRight size={16} className="ml-2" />
                </button>
              </div>
            </div>
          </div>

          {/* Regulatory Updates */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Regulatory Updates</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Latest changes and announcements</p>
              </div>
              <Bell className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-4">
              {regulatoryUpdates.map((update, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-corporate-blue/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{update.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      update.impact === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      update.impact === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {update.impact.toUpperCase()} IMPACT
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{update.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(update.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-sm text-corporate-blue hover:text-corporate-blue/80">
                      {update.action}
                      <ChevronRight size={14} className="ml-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Compliance Reports</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Generate and download compliance reports</p>
              </div>
              <button className="corporate-btn-primary px-4 py-2">
                <Send size={16} className="mr-2" />
                Generate New Report
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'GHG Protocol Report', period: 'Q4 2023', status: 'Generated', icon: Shield },
                { name: 'CSRD Sustainability Report', period: '2023', status: 'Draft', icon: FileText },
                { name: 'SBTi Progress Report', period: 'Annual 2023', status: 'Submitted', icon: Target },
                { name: 'CORSIA Emissions Report', period: '2023', status: 'Approved', icon: Globe },
                { name: 'TCFD Disclosure', period: '2023', status: 'Published', icon: Award },
                { name: 'Carbon Neutrality Statement', period: '2023', status: 'Generated', icon: CheckCircle },
              ].map((report, index) => {
                const Icon = report.icon
                return (
                  <div key={index} className="corporate-card p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Icon className="text-corporate-blue" size={20} />
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.status === 'Approved' || report.status === 'Submitted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        report.status === 'Generated' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {report.status}
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{report.name}</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Period: {report.period}</div>
                    <div className="flex space-x-2">
                      <button className="flex-1 corporate-btn-secondary text-sm px-3 py-2">
                        <Eye size={14} className="mr-1" />
                        Preview
                      </button>
                      <button className="flex-1 corporate-btn-primary text-sm px-3 py-2">
                        <Download size={14} className="mr-1" />
                        Download
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Frameworks Tab */}
      {activeTab === 'frameworks' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Compliance Frameworks</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Track compliance across regulatory frameworks</p>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Overall: {frameworks.filter(f => f.status === 'compliant' || f.status === 'approved').length}/{frameworks.length} compliant
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frameworks.map((framework) => {
                const Icon = framework.icon
                const completionRate = (framework.completed / framework.requirements) * 100
                
                return (
                  <div key={framework.id} className="corporate-card p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${framework.color}`}>
                          <Icon className="text-white" size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{framework.name}</h3>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{framework.description}</div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(framework.status)}`}>
                        {framework.status.replace('-', ' ')}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Requirements</span>
                        <span className="font-medium">
                          {framework.completed}/{framework.requirements}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-linear-to-r from-corporate-blue to-corporate-teal"
                          style={{ width: `${completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar size={12} className="mr-1" />
                        Updated {new Date(framework.lastUpdated).toLocaleDateString()}
                      </div>
                      <button className="text-corporate-blue hover:text-corporate-blue/80">
                        View Details
                        <ChevronRight size={12} className="ml-1" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Audit Trail</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Complete history of compliance activities</p>
              </div>
              <button className="corporate-btn-secondary px-4 py-2">
                <Download size={16} className="mr-2" />
                Export Audit Log
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Date & Time</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Action</th>
                    <th className="pb-3 font-medium">Framework</th>
                    <th className="pb-3 font-medium">Details</th>
                    <th className="pb-3 font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[
                    { date: '2024-03-18 14:32:18', user: 'Sarah Johnson', action: 'Report Generated', framework: 'GHG Protocol', details: 'Scope 1 & 2 Emissions Report', ip: '192.168.1.45' },
                    { date: '2024-03-18 11:15:42', user: 'System', action: 'Compliance Check', framework: 'CSRD', details: 'Automatic compliance validation', ip: 'System' },
                    { date: '2024-03-17 16:48:55', user: 'Michael Chen', action: 'Retirement Verified', framework: 'CORSIA', details: '10,000 tCO₂ retirement certificate', ip: '10.0.0.22' },
                    { date: '2024-03-17 09:21:33', user: 'Emma Wilson', action: 'Requirement Updated', framework: 'SBTi', details: 'Target validation submitted', ip: '192.168.1.102' },
                    { date: '2024-03-16 13:45:19', user: 'System', action: 'Data Sync', framework: 'All', details: 'Blockchain verification sync', ip: 'System' },
                    { date: '2024-03-16 08:12:47', user: 'David Lee', action: 'Report Submitted', framework: 'TCFD', details: 'Climate-related financial disclosures', ip: '10.0.0.45' },
                  ].map((audit, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(audit.date).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{audit.user}</div>
                      </td>
                      <td className="py-4">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          audit.user === 'System' 
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {audit.action}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{audit.framework}</div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{audit.details}</div>
                      </td>
                      <td className="py-4">
                        <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{audit.ip}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center">
                <Shield className="text-blue-600 dark:text-blue-400 mr-3" size={20} />
                <div>
                  <div className="font-medium text-blue-800 dark:text-blue-300">All actions are logged and timestamped</div>
                  <div className="text-sm text-blue-700/80 dark:text-blue-400/80">
                    Complete audit trail for regulatory compliance and internal controls
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <Users className="text-corporate-blue mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Compliance Team</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Contact your compliance team for support with regulatory requirements and reporting.
              </p>
              <button className="corporate-btn-primary text-sm px-4 py-2">
                Contact Team
              </button>
            </div>
          </div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <ExternalLink className="text-corporate-blue mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">External Resources</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Access official regulatory websites and documentation for each framework.
              </p>
              <button className="corporate-btn-secondary text-sm px-4 py-2">
                View Resources
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}