'use client'

import { useState } from 'react'
import { 
  Globe, 
  MapPin, 
  Filter, 
  Search, 
  TrendingUp, 
  Shield,
  Calendar,
  Users,
  Leaf,
  Eye,
  ExternalLink,
  ChevronRight,
  BarChart3,
  Download,
  Star,
  Clock,
  Target
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Line
} from 'recharts'

export default function ProjectsPage() {
  const { credits } = useCorporate()
  const [viewMode, setViewMode] = useState<'map' | 'grid' | 'list'>('grid')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    projectType: [] as string[],
    countries: [] as string[],
    verification: [] as string[],
    sdgs: [] as number[],
    minScore: 80,
    maxPrice: 30,
  })

  // Project types
  const projectTypes = [
    { id: 'forestry', name: 'Forestry & REDD+', icon: Leaf, count: 12 },
    { id: 'renewable', name: 'Renewable Energy', icon: TrendingUp, count: 8 },
    { id: 'agriculture', name: 'Agriculture', icon: Users, count: 6 },
    { id: 'bluecarbon', name: 'Blue Carbon', icon: Globe, count: 4 },
    { id: 'cookstoves', name: 'Clean Cookstoves', icon: Shield, count: 3 },
    { id: 'methane', name: 'Methane Capture', icon: Target, count: 2 },
  ]

  // Project impact metrics
  const projectImpactData = credits.map(project => ({
    name: project.projectName.substring(0, 20) + '...',
    carbon: project.availableAmount / 1000,
    score: project.dynamicScore,
    price: project.pricePerTon,
    country: project.country,
  }))

  // Country distribution
  const countryDistribution = [
    { country: 'Brazil', projects: 8, credits: 36000, avgScore: 91.5 },
    { country: 'Indonesia', projects: 6, credits: 27000, avgScore: 88.3 },
    { country: 'Kenya', projects: 5, credits: 19500, avgScore: 86.8 },
    { country: 'India', projects: 4, credits: 18000, avgScore: 87.5 },
    { country: 'USA', projects: 3, credits: 10500, avgScore: 94.2 },
    { country: 'Vietnam', projects: 2, credits: 7500, avgScore: 85.0 },
  ]

  // Project performance over time
  const performanceData = [
    { month: 'Jan', newProjects: 2, verifications: 5, score: 88.5 },
    { month: 'Feb', newProjects: 3, verifications: 7, score: 89.2 },
    { month: 'Mar', newProjects: 4, verifications: 9, score: 90.1 },
    { month: 'Apr', newProjects: 2, verifications: 6, score: 89.8 },
    { month: 'May', newProjects: 3, verifications: 8, score: 90.5 },
    { month: 'Jun', newProjects: 5, verifications: 10, score: 91.2 },
  ]

  // Calculate statistics
  const totalProjects = credits.length
  const totalCredits = credits.reduce((sum, p) => sum + p.availableAmount, 0)
  const avgScore = credits.reduce((sum, p) => sum + p.dynamicScore, 0) / totalProjects
  const avgPrice = credits.reduce((sum, p) => sum + p.pricePerTon, 0) / totalProjects

  // Get project type count
  const getProjectTypeCount = (type: string) => {
    const typeMap: Record<string, number> = {
      'REDD+': 4,
      'AR-AM0001': 2,
      'AMS-I.D.': 3,
      'VCS': 2,
    }
    return typeMap[type] || 0
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Projects Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Projects
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Explore verified carbon reduction projects worldwide. Track impact, verify quality, and invest in sustainable development.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Projects</div>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <div className="text-xs text-green-300">Across {countryDistribution.length} countries</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Available Credits</div>
              <div className="text-2xl font-bold">{(totalCredits / 1000).toFixed(1)}K tCO₂</div>
              <div className="text-xs text-blue-300">Ready for retirement</div>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="corporate-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <Globe className="text-corporate-blue mr-3" size={20} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">View Mode</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Choose how to explore projects</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {[
              { id: 'grid', label: 'Grid', icon: BarChart3 },
              { id: 'list', label: 'List', icon: Filter },
              { id: 'map', label: 'Map', icon: Globe },
            ].map((mode) => {
              const Icon = mode.icon
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as any)}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                    viewMode === mode.id
                      ? 'bg-corporate-blue text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={16} className="mr-2" />
                  {mode.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="corporate-card p-5">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="text-green-500" size={24} />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{avgScore.toFixed(1)}</span>
          </div>
          <div className="font-medium text-gray-900 dark:text-white mb-1">Avg. Quality Score</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Across all projects</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center justify-between mb-4">
            <Shield className="text-blue-500" size={24} />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{avgPrice.toFixed(2)}</span>
          </div>
          <div className="font-medium text-gray-900 dark:text-white mb-1">Avg. Price/ton</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Market average</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center justify-between mb-4">
            <Users className="text-purple-500" size={24} />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">35K+</span>
          </div>
          <div className="font-medium text-gray-900 dark:text-white mb-1">Community Impact</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">People benefited</div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-center justify-between mb-4">
            <Target className="text-orange-500" size={24} />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">9/17</span>
          </div>
          <div className="font-medium text-gray-900 dark:text-white mb-1">SDGs Supported</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Sustainable Development Goals</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Projects Grid/List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search and Filter */}
          <div className="corporate-card p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="search"
                    placeholder="Search projects by name, location, or methodology..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                  />
                </div>
              </div>
              <button className="corporate-btn-secondary px-4 py-2">
                <Filter size={16} className="mr-2" />
                Advanced Filters
              </button>
            </div>
          </div>

          {/* Project Type Categories */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Project Types</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {projectTypes.length} categories
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {projectTypes.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    onClick={() => setFilters({
                      ...filters,
                      projectType: filters.projectType.includes(type.id)
                        ? filters.projectType.filter(t => t !== type.id)
                        : [...filters.projectType, type.id]
                    })}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                      filters.projectType.includes(type.id)
                        ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-corporate-blue/50 hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2">
                        <Icon className="text-corporate-blue" size={20} />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white text-center text-sm mb-1">
                        {type.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {type.count} projects
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Projects Grid */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {credits.map((project) => (
                <div 
                  key={project.id} 
                  className="corporate-card hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="relative h-48 bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-t-xl overflow-hidden">
                    <div className="absolute top-4 right-4">
                      <div className="flex items-center space-x-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          project.status === 'available' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {project.status.toUpperCase()}
                        </div>
                        <div className="px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full text-xs font-medium">
                          ${project.pricePerTon}/ton
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <div className="text-lg font-bold text-corporate-navy dark:text-white">
                        {project.projectName}
                      </div>
                      <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                        <MapPin size={14} className="mr-1" />
                        {project.country}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Shield size={16} className="text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {project.verificationStandard}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Star size={16} className="text-yellow-500 mr-1" />
                        <span className="font-bold">{project.dynamicScore}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Available Credits</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-white">
                          {(project.availableAmount / 1000).toFixed(1)}K tCO₂
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Methodology</div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                          {project.methodology}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">SDG Impact</div>
                      <div className="flex flex-wrap gap-1">
                        {project.sdgs.map((sdg: number) => (
                          <span key={sdg} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                            {sdg}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button className="flex-1 corporate-btn-secondary text-sm px-3 py-2">
                        <Eye size={14} className="mr-1" />
                        Details
                      </button>
                      <button className="flex-1 corporate-btn-primary text-sm px-3 py-2">
                        <TrendingUp size={14} className="mr-1" />
                        Monitor
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Projects List View */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {credits.map((project) => (
                <div key={project.id} className="corporate-card p-5 hover:shadow-lg transition-all duration-300">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="md:w-1/4">
                      <div className="bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-xl p-4 h-full">
                        <div className="text-xl font-bold text-corporate-navy dark:text-white mb-1">
                          ${project.pricePerTon}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">Price per ton</div>
                      </div>
                    </div>
                    
                    <div className="md:w-1/2">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                          {project.projectName}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === 'available' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {project.status.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <MapPin size={14} className="mr-1" />
                        {project.country}
                        <Calendar size={14} className="ml-3 mr-1" />
                        Vintage {project.vintage}
                        <Shield size={14} className="ml-3 mr-1" />
                        {project.verificationStandard}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {(project.availableAmount / 1000).toFixed(1)}K tCO₂
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Methodology</div>
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {project.methodology}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Quality Score</div>
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  project.dynamicScore >= 90 ? 'bg-green-500' :
                                  project.dynamicScore >= 80 ? 'bg-blue-500' : 'bg-yellow-500'
                                }`}
                                style={{ width: `${project.dynamicScore}%` }}
                              ></div>
                            </div>
                            <span className="font-bold">{project.dynamicScore}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">SDGs</div>
                          <div className="flex space-x-1">
                            {project.sdgs.slice(0, 3).map((sdg: number) => (
                              <span key={sdg} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                                {sdg}
                              </span>
                            ))}
                            {project.sdgs.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                                +{project.sdgs.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="md:w-1/4">
                      <div className="flex flex-col space-y-2">
                        <button className="corporate-btn-secondary text-sm px-3 py-2">
                          <Eye size={14} className="mr-1" />
                          View Details
                        </button>
                        <button className="corporate-btn-primary text-sm px-3 py-2">
                          <TrendingUp size={14} className="mr-1" />
                          Add to Monitor
                        </button>
                        <button className="text-sm text-corporate-blue hover:text-corporate-blue/80 text-center">
                          <ExternalLink size={12} className="inline mr-1" />
                          Project Site
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-center">
            <nav className="flex items-center space-x-2">
              <button className="corporate-btn-secondary px-3 py-2 rounded-lg">← Previous</button>
              {[1, 2, 3, 4, 5].map((page) => (
                <button
                  key={page}
                  className={`px-3 py-2 rounded-lg ${
                    page === 1
                      ? 'bg-corporate-blue text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button className="corporate-btn-secondary px-3 py-2 rounded-lg">Next →</button>
            </nav>
          </div>
        </div>

        {/* Right Column - Analytics & Insights */}
        <div className="space-y-6">
          {/* Country Distribution */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Country Distribution</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Projects by location</p>
              </div>
              <MapPin className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-4">
              {countryDistribution.map((country) => (
                <div key={country.country}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="font-medium text-gray-900 dark:text-white">{country.country}</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {country.projects} projects
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-blue-500 to-teal-500"
                      style={{ width: `${(country.projects / 28) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{country.credits.toLocaleString()} tCO₂</span>
                    <span>Score: {country.avgScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project Performance */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Project Performance</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monthly trends</p>
              </div>
              <TrendingUp className="text-corporate-blue" size={20} />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[85, 95]} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'score') return [`${value}`, 'Quality Score']
                      return [value, name === 'newProjects' ? 'New Projects' : 'Verifications']
                    }}
                  />
                  <Bar yAxisId="left" dataKey="newProjects" fill="#0073e6" name="New Projects" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="verifications" fill="#00d4aa" name="Verifications" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} name="Quality Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Impact Analysis */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Impact Analysis</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Carbon vs. quality correlation</p>
              </div>
              <Target className="text-corporate-blue" size={20} />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    dataKey="carbon" 
                    name="Carbon Volume" 
                    unit="K tCO₂" 
                    domain={[0, 50]}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="score" 
                    name="Quality Score" 
                    domain={[80, 100]}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => {
                      if (name === 'carbon') return [`${value}K tCO₂`, 'Carbon Volume']
                      return [value, 'Quality Score']
                    }}
                    labelFormatter={(label) => `Project: ${label}`}
                  />
                  <Scatter
                    name="Projects"
                    data={projectImpactData}
                    fill="#0073e6"
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Monitoring */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Project Monitoring</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tracked projects</p>
              </div>
              <Eye className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-3">
              {credits.slice(0, 3).map((project) => (
                <div key={project.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {project.projectName.substring(0, 25)}...
                    </div>
                    <div className="flex items-center">
                      <Clock size={12} className="text-gray-400 mr-1" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Updated {new Date(project.lastVerification).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600 dark:text-gray-400">
                      <MapPin size={12} className="inline mr-1" />
                      {project.country}
                    </div>
                    <div className="font-bold text-corporate-blue">
                      {project.dynamicScore}
                    </div>
                  </div>
                </div>
              ))}
              <button className="w-full corporate-btn-secondary py-2 mt-2">
                <Eye size={16} className="mr-2" />
                View All Monitored
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <Download className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">
                Export Project Data
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">CSV, Excel, or JSON formats</div>
            </div>
          </div>
        </button>
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <BarChart3 className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">
                Generate Project Report
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Detailed analysis and insights</div>
            </div>
          </div>
        </button>
        <button className="corporate-card p-5 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center">
            <Users className="text-corporate-blue mr-3" size={24} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white group-hover:text-corporate-blue">
                Share Project List
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Team or external partners</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}