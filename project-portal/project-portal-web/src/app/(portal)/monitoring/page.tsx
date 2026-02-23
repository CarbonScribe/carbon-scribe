// File: app/monitoring/page.tsx
'use client';

import { useState } from 'react';
import { 
  Satellite, 
  AlertTriangle, 
  CheckCircle, 
  Camera, 
  Upload, 
  Filter,
  Download,
  BarChart3,
  MapPin,
  Calendar,
  Eye,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  AlertCircle
} from 'lucide-react';
import MonitoringAlerts from '@/components/monitoring/MonitoringAlerts';

const MonitoringPage = () => {
  const [timeRange, setTimeRange] = useState('30d');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedProject, setSelectedProject] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock monitoring data
  const monitoringData = [
    {
      id: 1,
      projectName: 'Amazon Rainforest Restoration',
      type: 'satellite',
      status: 'healthy',
      lastUpdated: '15 minutes ago',
      metrics: {
        ndvi: 0.78,
        biomass: '+12%',
        canopy: '68%',
        health: 'Excellent'
      },
      alerts: 0,
      images: 24,
      location: 'Amazon Basin, Brazil',
      nextVerification: 'Dec 15, 2024',
      sensorStatus: 'online'
    },
    {
      id: 2,
      projectName: 'Kenyan Agroforestry Initiative',
      type: 'iot',
      status: 'warning',
      lastUpdated: '2 hours ago',
      metrics: {
        ndvi: 0.65,
        biomass: '+5%',
        canopy: '54%',
        health: 'Good'
      },
      alerts: 2,
      images: 18,
      location: 'Kenya Highlands',
      nextVerification: 'Nov 30, 2024',
      sensorStatus: 'partial'
    },
    {
      id: 3,
      projectName: 'Sundarbans Mangrove Conservation',
      type: 'satellite',
      status: 'critical',
      lastUpdated: '6 hours ago',
      metrics: {
        ndvi: 0.42,
        biomass: '-8%',
        canopy: '38%',
        health: 'Poor'
      },
      alerts: 5,
      images: 32,
      location: 'Sundarbans, Bangladesh',
      nextVerification: 'Jan 15, 2025',
      sensorStatus: 'offline'
    },
    {
      id: 4,
      projectName: 'Midwest Soil Carbon Project',
      type: 'iot',
      status: 'healthy',
      lastUpdated: '30 minutes ago',
      metrics: {
        ndvi: 0.72,
        biomass: '+18%',
        canopy: '62%',
        health: 'Excellent'
      },
      alerts: 0,
      images: 16,
      location: 'Midwest, USA',
      nextVerification: 'Feb 28, 2025',
      sensorStatus: 'online'
    },
    {
      id: 5,
      projectName: 'Ethiopian Forest Protection',
      type: 'satellite',
      status: 'healthy',
      lastUpdated: '45 minutes ago',
      metrics: {
        ndvi: 0.81,
        biomass: '+15%',
        canopy: '72%',
        health: 'Excellent'
      },
      alerts: 1,
      images: 28,
      location: 'Bale Mountains, Ethiopia',
      nextVerification: 'Mar 15, 2025',
      sensorStatus: 'online'
    },
    {
      id: 6,
      projectName: 'Vietnam Bamboo Plantation',
      type: 'iot',
      status: 'warning',
      lastUpdated: '3 hours ago',
      metrics: {
        ndvi: 0.58,
        biomass: '+3%',
        canopy: '49%',
        health: 'Fair'
      },
      alerts: 3,
      images: 12,
      location: 'Mekong Delta, Vietnam',
      nextVerification: 'Apr 10, 2025',
      sensorStatus: 'partial'
    },
  ];

  const statusConfig = {
    healthy: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    warning: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
    critical: { color: 'bg-red-100 text-red-700', icon: AlertCircle }
  };

  const sensorConfig = {
    online: { color: 'bg-emerald-100 text-emerald-700', label: 'Online' },
    partial: { color: 'bg-amber-100 text-amber-700', label: 'Partial' },
    offline: { color: 'bg-gray-100 text-gray-700', label: 'Offline' }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Project Monitoring</h1>
            <p className="text-emerald-100 opacity-90">Real-time tracking of all your regenerative agriculture projects</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              {autoRefresh ? (
                <>
                  <PauseCircle className="w-5 h-5 mr-2" />
                  Pause Auto-refresh
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Resume Auto-refresh
                </>
              )}
            </button>
            <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
              + Add Monitoring Device
            </button>
          </div>
        </div>
      </div>

      {/* Live Monitoring Dashboard - Using your MonitoringAlerts component */}
      <MonitoringAlerts />

      {/* Filters & Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="all">All Projects</option>
                <option value="healthy">Healthy Only</option>
                <option value="warning">With Warnings</option>
                <option value="critical">Critical Only</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </button>
            
            <button className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Monitoring Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monitoringData.map((project) => {
            const StatusIcon = statusConfig[project.status as keyof typeof statusConfig].icon;
            const statusColor = statusConfig[project.status as keyof typeof statusConfig].color;
            const sensorInfo = sensorConfig[project.sensorStatus as keyof typeof sensorConfig];
            
            return (
              <div key={project.id} className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-emerald-300 hover:shadow-xl transition-all duration-300">
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{project.projectName}</h3>
                    <div className="flex items-center text-gray-600 text-sm">
                      <MapPin className="w-4 h-4 mr-1" />
                      {project.location}
                    </div>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                    <StatusIcon className="w-4 h-4 mr-2" />
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(project.metrics).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-gray-900">{value}</div>
                      <div className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                    </div>
                  ))}
                </div>

                {/* Status & Info */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Last Updated</div>
                    <div className="text-sm font-medium text-gray-900">{project.lastUpdated}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Sensor Status</div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${sensorInfo.color}`}>
                      {sensorInfo.label}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Next Verification</div>
                    <div className="text-sm font-medium text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {project.nextVerification}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Camera className="w-4 h-4 mr-1" />
                      {project.images} images
                    </div>
                    {project.alerts > 0 && (
                      <div className="flex items-center text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        {project.alerts} alerts
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Upload className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;























// // File: app/monitoring/page.tsx
// 'use client';

// import { useState } from 'react';
// import { 
//   Satellite, 
//   AlertTriangle, 
//   CheckCircle, 
//   Clock, 
//   Camera, 
//   Upload, 
//   Filter,
//   Download,
//   BarChart3,
//   MapPin,
//   Calendar,
//   Eye,
//   RefreshCw,
//   PlayCircle,
//   PauseCircle,
//   AlertCircle
// } from 'lucide-react';

// const MonitoringPage = () => {
//   const [timeRange, setTimeRange] = useState('30d');
//   const [viewMode, setViewMode] = useState('grid');
//   const [selectedProject, setSelectedProject] = useState('all');
//   const [autoRefresh, setAutoRefresh] = useState(true);

//   // Mock monitoring data
//   const monitoringData = [
//     {
//       id: 1,
//       projectName: 'Amazon Rainforest Restoration',
//       type: 'satellite',
//       status: 'healthy',
//       lastUpdated: '15 minutes ago',
//       metrics: {
//         ndvi: 0.78,
//         biomass: '+12%',
//         canopy: '68%',
//         health: 'Excellent'
//       },
//       alerts: 0,
//       images: 24,
//       location: 'Amazon Basin, Brazil',
//       nextVerification: 'Dec 15, 2024',
//       sensorStatus: 'online'
//     },
//     {
//       id: 2,
//       projectName: 'Kenyan Agroforestry Initiative',
//       type: 'iot',
//       status: 'warning',
//       lastUpdated: '2 hours ago',
//       metrics: {
//         ndvi: 0.65,
//         biomass: '+5%',
//         canopy: '54%',
//         health: 'Good'
//       },
//       alerts: 2,
//       images: 18,
//       location: 'Kenya Highlands',
//       nextVerification: 'Nov 30, 2024',
//       sensorStatus: 'partial'
//     },
//     {
//       id: 3,
//       projectName: 'Sundarbans Mangrove Conservation',
//       type: 'satellite',
//       status: 'critical',
//       lastUpdated: '6 hours ago',
//       metrics: {
//         ndvi: 0.42,
//         biomass: '-8%',
//         canopy: '38%',
//         health: 'Poor'
//       },
//       alerts: 5,
//       images: 32,
//       location: 'Sundarbans, Bangladesh',
//       nextVerification: 'Jan 15, 2025',
//       sensorStatus: 'offline'
//     },
//     {
//       id: 4,
//       projectName: 'Midwest Soil Carbon Project',
//       type: 'iot',
//       status: 'healthy',
//       lastUpdated: '30 minutes ago',
//       metrics: {
//         ndvi: 0.72,
//         biomass: '+18%',
//         canopy: '62%',
//         health: 'Excellent'
//       },
//       alerts: 0,
//       images: 16,
//       location: 'Midwest, USA',
//       nextVerification: 'Feb 28, 2025',
//       sensorStatus: 'online'
//     },
//     {
//       id: 5,
//       projectName: 'Ethiopian Forest Protection',
//       type: 'satellite',
//       status: 'healthy',
//       lastUpdated: '45 minutes ago',
//       metrics: {
//         ndvi: 0.81,
//         biomass: '+15%',
//         canopy: '72%',
//         health: 'Excellent'
//       },
//       alerts: 1,
//       images: 28,
//       location: 'Bale Mountains, Ethiopia',
//       nextVerification: 'Mar 15, 2025',
//       sensorStatus: 'online'
//     },
//     {
//       id: 6,
//       projectName: 'Vietnam Bamboo Plantation',
//       type: 'iot',
//       status: 'warning',
//       lastUpdated: '3 hours ago',
//       metrics: {
//         ndvi: 0.58,
//         biomass: '+3%',
//         canopy: '49%',
//         health: 'Fair'
//       },
//       alerts: 3,
//       images: 12,
//       location: 'Mekong Delta, Vietnam',
//       nextVerification: 'Apr 10, 2025',
//       sensorStatus: 'partial'
//     },
//   ];

//   const statusConfig = {
//     healthy: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
//     warning: { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
//     critical: { color: 'bg-red-100 text-red-700', icon: AlertCircle }
//   };

//   const sensorConfig = {
//     online: { color: 'bg-emerald-100 text-emerald-700', label: 'Online' },
//     partial: { color: 'bg-amber-100 text-amber-700', label: 'Partial' },
//     offline: { color: 'bg-gray-100 text-gray-700', label: 'Offline' }
//   };

//   return (
//     <div className="space-y-6 animate-fadeIn">
//       {/* Header */}
//       <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
//         <div className="flex flex-col md:flex-row md:items-center justify-between">
//           <div>
//             <h1 className="text-3xl font-bold mb-3">Project Monitoring</h1>
//             <p className="text-emerald-100 opacity-90">Real-time tracking of all your regenerative agriculture projects</p>
//           </div>
//           <div className="mt-4 md:mt-0 flex items-center space-x-4">
//             <button
//               onClick={() => setAutoRefresh(!autoRefresh)}
//               className="flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
//             >
//               {autoRefresh ? (
//                 <>
//                   <PauseCircle className="w-5 h-5 mr-2" />
//                   Pause Auto-refresh
//                 </>
//               ) : (
//                 <>
//                   <PlayCircle className="w-5 h-5 mr-2" />
//                   Resume Auto-refresh
//                 </>
//               )}
//             </button>
//             <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
//               + Add Monitoring Device
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Stats Summary */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         {[
//           { label: 'Projects Monitored', value: '6', icon: Satellite, color: 'bg-blue-500' },
//           { label: 'Active Sensors', value: '42', icon: Camera, color: 'bg-emerald-500' },
//           { label: 'Critical Alerts', value: '5', icon: AlertTriangle, color: 'bg-red-500' },
//           { label: 'Avg. Health Score', value: '78%', icon: BarChart3, color: 'bg-purple-500' },
//         ].map((stat, index) => {
//           const Icon = stat.icon;
//           return (
//             <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
//                   <div className="text-sm text-gray-600">{stat.label}</div>
//                 </div>
//                 <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
//                   <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       {/* Filters & Controls */}
//       <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
//         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
//           <div className="flex items-center space-x-4">
//             <div className="flex items-center space-x-2">
//               <Filter className="w-5 h-5 text-gray-600" />
//               <select
//                 value={selectedProject}
//                 onChange={(e) => setSelectedProject(e.target.value)}
//                 className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
//               >
//                 <option value="all">All Projects</option>
//                 <option value="healthy">Healthy Only</option>
//                 <option value="warning">With Warnings</option>
//                 <option value="critical">Critical Only</option>
//               </select>
//             </div>
            
//             <div className="flex items-center space-x-2">
//               <select
//                 value={timeRange}
//                 onChange={(e) => setTimeRange(e.target.value)}
//                 className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
//               >
//                 <option value="7d">Last 7 Days</option>
//                 <option value="30d">Last 30 Days</option>
//                 <option value="90d">Last 90 Days</option>
//                 <option value="1y">Last Year</option>
//               </select>
//             </div>
//           </div>
          
//           <div className="flex items-center space-x-4">
//             <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center">
//               <Download className="w-4 h-4 mr-2" />
//               Export Data
//             </button>
            
//             <button className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
//               <RefreshCw className="w-5 h-5" />
//             </button>
            
//             <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
//               <button
//                 onClick={() => setViewMode('grid')}
//                 className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
//               >
//                 Grid
//               </button>
//               <button
//                 onClick={() => setViewMode('list')}
//                 className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
//               >
//                 List
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Monitoring Grid */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           {monitoringData.map((project) => {
//             const StatusIcon = statusConfig[project.status as keyof typeof statusConfig].icon;
//             const statusColor = statusConfig[project.status as keyof typeof statusConfig].color;
//             const sensorInfo = sensorConfig[project.sensorStatus as keyof typeof sensorConfig];
            
//             return (
//               <div key={project.id} className="bg-white border-2 border-gray-200 rounded-2xl p-6 hover:border-emerald-300 hover:shadow-xl transition-all duration-300">
//                 {/* Project Header */}
//                 <div className="flex items-start justify-between mb-4">
//                   <div>
//                     <h3 className="font-bold text-gray-900 text-lg mb-1">{project.projectName}</h3>
//                     <div className="flex items-center text-gray-600 text-sm">
//                       <MapPin className="w-4 h-4 mr-1" />
//                       {project.location}
//                     </div>
//                   </div>
//                   <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
//                     <StatusIcon className="w-4 h-4 mr-2" />
//                     {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
//                   </div>
//                 </div>

//                 {/* Metrics */}
//                 <div className="grid grid-cols-2 gap-3 mb-4">
//                   {Object.entries(project.metrics).map(([key, value]) => (
//                     <div key={key} className="bg-gray-50 rounded-lg p-3">
//                       <div className="text-lg font-bold text-gray-900">{value}</div>
//                       <div className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
//                     </div>
//                   ))}
//                 </div>

//                 {/* Status & Info */}
//                 <div className="space-y-3 mb-6">
//                   <div className="flex items-center justify-between">
//                     <div className="text-sm text-gray-600">Last Updated</div>
//                     <div className="text-sm font-medium text-gray-900">{project.lastUpdated}</div>
//                   </div>
//                   <div className="flex items-center justify-between">
//                     <div className="text-sm text-gray-600">Sensor Status</div>
//                     <div className={`text-xs font-medium px-2 py-1 rounded-full ${sensorInfo.color}`}>
//                       {sensorInfo.label}
//                     </div>
//                   </div>
//                   <div className="flex items-center justify-between">
//                     <div className="text-sm text-gray-600">Next Verification</div>
//                     <div className="text-sm font-medium text-gray-900 flex items-center">
//                       <Calendar className="w-4 h-4 mr-1" />
//                       {project.nextVerification}
//                     </div>
//                   </div>
//                 </div>

//                 {/* Actions */}
//                 <div className="flex items-center justify-between pt-4 border-t border-gray-200">
//                   <div className="flex items-center space-x-2">
//                     <div className="flex items-center text-sm text-gray-600">
//                       <Camera className="w-4 h-4 mr-1" />
//                       {project.images} images
//                     </div>
//                     {project.alerts > 0 && (
//                       <div className="flex items-center text-sm text-red-600">
//                         <AlertTriangle className="w-4 h-4 mr-1" />
//                         {project.alerts} alerts
//                       </div>
//                     )}
//                   </div>
//                   <div className="flex items-center space-x-2">
//                     <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
//                       <Eye className="w-5 h-5 text-gray-600" />
//                     </button>
//                     <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
//                       <Upload className="w-5 h-5 text-gray-600" />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Alerts Section */}
//       <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
//         <div className="flex items-center justify-between mb-6">
//           <h3 className="text-xl font-bold text-gray-900">Recent Alerts</h3>
//           <button className="text-emerald-600 hover:text-emerald-700 font-medium">
//             View All Alerts →
//           </button>
//         </div>
        
//         <div className="space-y-4">
//           {[
//             {
//               id: 1,
//               project: 'Sundarbans Mangrove Conservation',
//               type: 'critical',
//               message: 'NDVI dropped by 25% in Zone B',
//               time: '6 hours ago',
//               action: 'requires_verification'
//             },
//             {
//               id: 2,
//               project: 'Kenyan Agroforestry Initiative',
//               type: 'warning',
//               message: 'Soil moisture sensor offline in Sector 3',
//               time: '2 hours ago',
//               action: 'maintenance_required'
//             },
//             {
//               id: 3,
//               project: 'Vietnam Bamboo Plantation',
//               type: 'warning',
//               message: 'Lower-than-expected growth rate detected',
//               time: '1 day ago',
//               action: 'review_needed'
//             },
//           ].map((alert) => (
//             <div key={alert.id} className={`flex items-start p-4 rounded-xl border-2 ${
//               alert.type === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
//             }`}>
//               <div className={`p-2 rounded-lg mr-4 ${
//                 alert.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
//               }`}>
//                 <AlertTriangle className="w-5 h-5" />
//               </div>
//               <div className="flex-1">
//                 <div className="font-medium text-gray-900">{alert.project}</div>
//                 <div className="text-gray-600 mt-1">{alert.message}</div>
//                 <div className="flex items-center justify-between mt-3">
//                   <div className="text-sm text-gray-500">{alert.time}</div>
//                   <button className={`px-3 py-1 text-sm font-medium rounded-lg ${
//                     alert.type === 'critical' 
//                       ? 'bg-red-100 text-red-700 hover:bg-red-200' 
//                       : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
//                   }`}>
//                     {alert.action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MonitoringPage;