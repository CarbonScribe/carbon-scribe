'use client';

import { useState } from 'react';
import { 
  FileText, 
  Download, 
  Upload, 
  Folder,
  Search,
  Filter,
  Calendar,
  User,
  Eye,
  Share2,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle,
  FileType,
  Image,
  FileArchive,
  BarChart,
  Globe,
  Lock,
  Unlock,
  Trash2,
  Edit,
  Star,
  Tag,
  FolderPlus,
  Grid,
  List,
  X
} from 'lucide-react';

const DocumentsPage = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  // Mock documents data
  const documents = [
    {
      id: 1,
      name: 'Project Design Document',
      type: 'pdf',
      category: 'planning',
      project: 'Amazon Rainforest Restoration',
      size: '2.4 MB',
      uploadDate: 'Jan 10, 2023',
      uploadBy: 'Maria Santos',
      status: 'approved',
      version: 'v2.1',
      downloads: 42,
      tags: ['PDD', 'Methodology', 'Planning'],
      icon: '📋'
    },
    {
      id: 2,
      name: 'Q3 2024 Monitoring Report',
      type: 'pdf',
      category: 'monitoring',
      project: 'Kenyan Agroforestry Initiative',
      size: '3.1 MB',
      uploadDate: 'Oct 15, 2024',
      uploadBy: 'Samuel Kariuki',
      status: 'pending',
      version: 'v1.0',
      downloads: 18,
      tags: ['Monitoring', 'Quarterly', 'Progress'],
      icon: '📊'
    },
    {
      id: 3,
      name: 'Verification Certificate',
      type: 'pdf',
      category: 'certification',
      project: 'Sundarbans Mangrove Conservation',
      size: '1.8 MB',
      uploadDate: 'Jun 30, 2023',
      uploadBy: 'Verification Team',
      status: 'approved',
      version: 'v1.0',
      downloads: 56,
      tags: ['Certification', 'VCS', 'Verified'],
      icon: '🏅'
    },
    {
      id: 4,
      name: 'Satellite Imagery - Zone A',
      type: 'zip',
      category: 'data',
      project: 'All Projects',
      size: '45.2 MB',
      uploadDate: 'Sep 20, 2024',
      uploadBy: 'Satellite System',
      status: 'approved',
      version: 'v3.2',
      downloads: 24,
      tags: ['Satellite', 'Geospatial', 'Raw Data'],
      icon: '🛰️'
    },
    {
      id: 5,
      name: 'Community Engagement Photos',
      type: 'folder',
      category: 'media',
      project: 'Ethiopian Forest Protection',
      size: '128.5 MB',
      uploadDate: 'Aug 12, 2024',
      uploadBy: 'Amina Diallo',
      status: 'approved',
      version: null,
      downloads: 89,
      tags: ['Photos', 'Community', 'Progress'],
      icon: '📸'
    },
    {
      id: 6,
      name: 'Soil Analysis Results',
      type: 'xlsx',
      category: 'data',
      project: 'Midwest Soil Carbon Project',
      size: '4.7 MB',
      uploadDate: 'Mar 5, 2024',
      uploadBy: 'Raj Patel',
      status: 'approved',
      version: 'v1.3',
      downloads: 31,
      tags: ['Soil', 'Analysis', 'Data'],
      icon: '🧪'
    },
    {
      id: 7,
      name: 'Financial Audit Report',
      type: 'pdf',
      category: 'finance',
      project: 'All Projects',
      size: '5.2 MB',
      uploadDate: 'Feb 28, 2024',
      uploadBy: 'Finance Team',
      status: 'approved',
      version: 'v1.0',
      downloads: 23,
      tags: ['Finance', 'Audit', 'Compliance'],
      icon: '💰'
    },
    {
      id: 8,
      name: 'Methodology Application',
      type: 'pdf',
      category: 'planning',
      project: 'Vietnam Bamboo Plantation',
      size: '3.8 MB',
      uploadDate: 'Jul 15, 2023',
      uploadBy: 'Chen Wei',
      status: 'rejected',
      version: 'v1.2',
      downloads: 12,
      tags: ['Methodology', 'VM0018', 'Application'],
      icon: '📝'
    },
    {
      id: 9,
      name: 'Drone Survey Data',
      type: 'zip',
      category: 'data',
      project: 'Amazon Rainforest Restoration',
      size: '89.3 MB',
      uploadDate: 'Nov 3, 2024',
      uploadBy: 'Carlos Mendez',
      status: 'approved',
      version: 'v2.0',
      downloads: 15,
      tags: ['Drone', 'Survey', '3D Model'],
      icon: '🚁'
    },
    {
      id: 10,
      name: 'Training Materials',
      type: 'folder',
      category: 'training',
      project: 'All Projects',
      size: '56.7 MB',
      uploadDate: 'May 20, 2024',
      uploadBy: 'Training Team',
      status: 'approved',
      version: null,
      downloads: 156,
      tags: ['Training', 'Education', 'Resources'],
      icon: '📚'
    },
    {
      id: 11,
      name: 'Carbon Credit Registry',
      type: 'xlsx',
      category: 'finance',
      project: 'All Projects',
      size: '2.1 MB',
      uploadDate: 'Apr 10, 2024',
      uploadBy: 'System',
      status: 'approved',
      version: 'v4.5',
      downloads: 78,
      tags: ['Registry', 'Credits', 'Tracking'],
      icon: '♻️'
    },
    {
      id: 12,
      name: 'Environmental Impact Assessment',
      type: 'pdf',
      category: 'planning',
      project: 'Kenyan Agroforestry Initiative',
      size: '6.8 MB',
      uploadDate: 'Dec 5, 2023',
      uploadBy: 'Environmental Team',
      status: 'approved',
      version: 'v1.5',
      downloads: 34,
      tags: ['EIA', 'Assessment', 'Environment'],
      icon: '🌍'
    },
  ];

  const categories = [
    { id: 'all', name: 'All Documents', count: documents.length, icon: Folder, color: 'bg-gray-500' },
    { id: 'planning', name: 'Planning', count: documents.filter(d => d.category === 'planning').length, icon: FileText, color: 'bg-blue-500' },
    { id: 'monitoring', name: 'Monitoring', count: documents.filter(d => d.category === 'monitoring').length, icon: BarChart, color: 'bg-emerald-500' },
    { id: 'certification', name: 'Certification', count: documents.filter(d => d.category === 'certification').length, icon: CheckCircle, color: 'bg-purple-500' },
    { id: 'data', name: 'Raw Data', count: documents.filter(d => d.category === 'data').length, icon: FileArchive, color: 'bg-amber-500' },
    { id: 'media', name: 'Media', count: documents.filter(d => d.category === 'media').length, icon: Image, color: 'bg-pink-500' },
    { id: 'finance', name: 'Financial', count: documents.filter(d => d.category === 'finance').length, icon: FileType, color: 'bg-green-500' },
    { id: 'training', name: 'Training', count: documents.filter(d => d.category === 'training').length, icon: FileText, color: 'bg-cyan-500' },
  ];

  const getStatusConfig = (status: string) => {
    const configs = {
      approved: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Approved' },
      pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
      rejected: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Rejected' },
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };



const getTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      pdf: <FileText className="w-5 h-5 text-red-500" />,
      xlsx: <FileText className="w-5 h-5 text-green-500" />,
      zip: <FileArchive className="w-5 h-5 text-amber-500" />,
      folder: <Folder className="w-5 h-5 text-blue-500" />,
    };
    return icons[type] || <FileText className="w-5 h-5 text-gray-500" />;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const toggleFileSelection = (id: number) => {
    setSelectedFiles(prev => 
      prev.includes(id) 
        ? prev.filter(fileId => fileId !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Project Documents</h1>
            <p className="text-emerald-100 opacity-90">Central repository for all project documents and reports</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button className="flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors">
              <FolderPlus className="w-5 h-5 mr-2" />
              New Folder
            </button>
            <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Upload Files
            </button>
          </div>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: '248', icon: FileText, color: 'bg-blue-500' },
          { label: 'Storage Used', value: '856 MB', icon: Folder, color: 'bg-emerald-500' },
          { label: 'Shared Files', value: '42', icon: Share2, color: 'bg-purple-500' },
          { label: 'Pending Review', value: '3', icon: Clock, color: 'bg-amber-500' },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Categories */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-6">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                      selectedCategory === category.id
                        ? 'bg-emerald-50 border-2 border-emerald-200'
                        : 'border border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${category.color} bg-opacity-10 mr-3`}>
                        <Icon className={`w-5 h-5 ${category.color.replace('bg-', 'text-')}`} />
                      </div>
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {category.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Recent Activity */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-bold text-gray-900 mb-4">Recent Activity</h4>
              <div className="space-y-3">
                {[
                  { action: 'Uploaded "Soil Analysis"', user: 'Raj Patel', time: '2 hours ago' },
                  { action: 'Approved "Monitoring Report"', user: 'Samuel Kariuki', time: '1 day ago' },
                  { action: 'Downloaded "Training Materials"', user: 'New Farmer', time: '2 days ago' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-start">
                    <div className="p-1 rounded-lg bg-gray-100 mr-3">
                      <FileText className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-900">{activity.action}</div>
                      <div className="text-xs text-gray-500">
                        by {activity.user} • {activity.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Documents */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents by name, project, or tags..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors">
                    <option>Sort by: Newest</option>
                    <option>Sort by: Name</option>
                    <option>Sort by: Size</option>
                    <option>Sort by: Downloads</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Selection Bar */}
            {selectedFiles.length > 0 && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-3" />
                  <span className="font-medium text-gray-900">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                    Download All
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                    Share
                  </button>
                  <button className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700">
                    Delete
                  </button>
                  <button 
                    onClick={() => setSelectedFiles([])}
                    className="p-1 hover:bg-emerald-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Documents Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => {
                  const statusConfig = getStatusConfig(doc.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div 
                      key={doc.id}
                      className={`border border-gray-200 rounded-xl p-6 hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer ${
                        selectedFiles.includes(doc.id) ? 'border-2 border-emerald-400 bg-emerald-50' : ''
                      }`}
                      onClick={() => toggleFileSelection(doc.id)}
                    >
                      {/* Document Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">{doc.icon}</div>
                          <div>
                            <h3 className="font-bold text-gray-900 line-clamp-1">{doc.name}</h3>
                            <div className="text-sm text-gray-600">{doc.project}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedFiles.includes(doc.id) && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          )}
                          <button className="p-1 hover:bg-gray-100 rounded-lg">
                            <MoreVertical className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                      </div>

                      {/* Document Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Type</div>
                          <div className="flex items-center">
                            {getTypeIcon(doc.type)}
                            <span className="ml-2 font-medium text-gray-900">{doc.type.toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Size</div>
                          <div className="font-medium text-gray-900">{doc.size}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Uploaded</div>
                          <div className="font-medium text-gray-900">{doc.uploadDate}</div>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4 mr-2" />
                          {statusConfig.label}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={(e) => { e.stopPropagation(); }}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button 
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={(e) => { e.stopPropagation(); }}
                          >
                            <Download className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-2">
                          {doc.tags.slice(0, 2).map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              +{doc.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Size</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Modified</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc) => {
                      const statusConfig = getStatusConfig(doc.status);
                      const StatusIcon = statusConfig.icon;
                      
                      return (
                        <tr 
                          key={doc.id} 
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            selectedFiles.includes(doc.id) ? 'bg-emerald-50' : ''
                          }`}
                          onClick={() => toggleFileSelection(doc.id)}
                        >
                          <td className="py-4 px-4">
                            <input 
                              type="checkbox" 
                              checked={selectedFiles.includes(doc.id)}
                              onChange={() => toggleFileSelection(doc.id)}
                              className="rounded border-gray-300"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <div className="text-xl mr-3">{doc.icon}</div>
                              <div>
                                <div className="font-medium text-gray-900">{doc.name}</div>
                                <div className="text-sm text-gray-600 flex items-center">
                                  {getTypeIcon(doc.type)}
                                  <span className="ml-2">{doc.type.toUpperCase()}</span>
                                  {doc.version && <span className="ml-2">• {doc.version}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{doc.project}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{doc.size}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-gray-900">{doc.uploadDate}</div>
                            <div className="text-xs text-gray-600">by {doc.uploadBy}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                              <StatusIcon className="w-4 h-4 mr-2" />
                              {statusConfig.label}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button className="p-2 hover:bg-gray-100 rounded-lg">
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg">
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg">
                                <Share2 className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty State */}
            {filteredDocuments.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📁</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No documents found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
                <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                  Upload Your First Document
                </button>
              </div>
            )}
          </div>

          {/* Recent Uploads */}
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Recently Uploaded</h3>
              <button className="text-emerald-600 hover:text-emerald-700 font-medium">
                View All →
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documents.slice(0, 3).map((doc) => (
                <div key={doc.id} className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="text-2xl mr-4">{doc.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 line-clamp-1">{doc.name}</div>
                    <div className="text-sm text-gray-600">{doc.project}</div>
                    <div className="text-xs text-gray-500 mt-1">{doc.uploadDate}</div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;