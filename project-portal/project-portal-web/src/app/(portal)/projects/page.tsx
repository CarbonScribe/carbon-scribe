'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  Target, 
  Users, 
  Calendar,
  Filter,
  Search,
  Grid3x3,
  List,
  ChevronRight,
  MoreVertical,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { useFilteredProjects, useProjectStats } from '@/lib/store/projects/projects.selectors';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog';
import ProjectLoadingSkeleton from '@/components/projects/ProjectLoadingSkeleton';

const PROJECT_TYPES = ['All', 'Reforestation', 'Agroforestry', 'Blue Carbon', 'Regenerative Farming', 'REDD+', 'Afforestation'];
const STATUSES = ['All', 'active', 'completed', 'pending'];

export default function ProjectsPage() {
  const router = useRouter();
  const fetchProjects = useStore((state) => state.fetchProjects);
  const loading = useStore((state) => state.loading);
  const errors = useStore((state) => state.errors);
  const filters = useStore((state) => state.filters);
  const setFilters = useStore((state) => state.setFilters);
  const pagination = useStore((state) => state.pagination);

  const filteredProjects = useFilteredProjects();
  const stats = useProjectStats();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleNextPage = () => {
    const newOffset = pagination.offset + pagination.limit;
    fetchProjects(pagination.limit, newOffset);
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchProjects(pagination.limit, newOffset);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Project Portfolio</h1>
            <p className="text-emerald-100">Manage all your regenerative agriculture projects in one place</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 md:mt-0 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
          >
            <span>+ New Project</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                placeholder="Search projects by name or location..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filters.type}
                onChange={(e) => setFilters({ type: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                {PROJECT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ status: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                {STATUSES.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Grid3x3 className="w-5 h-5" />
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Projects', value: stats.totalProjects, icon: '📊', color: 'bg-blue-500' },
            { label: 'Active Projects', value: stats.activeProjects, icon: '🌱', color: 'bg-emerald-500' },
            { label: 'Total Credits', value: stats.totalCarbonCredits, icon: '♻️', color: 'bg-teal-500' },
            { label: 'Total Farmers', value: stats.totalFarmers, icon: '👨‍🌾', color: 'bg-amber-500' },
          ].map((stat, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
                <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                  <span className="text-xl">{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading.isFetching && filteredProjects.length === 0 && (
        <ProjectLoadingSkeleton count={6} />
      )}

      {/* Error state */}
      {errors.fetch && filteredProjects.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Unable to load projects</h3>
          <p className="text-gray-600 mb-4">{errors.fetch}</p>
          <button
            onClick={() => fetchProjects()}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            {loading.isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            Try Again
          </button>
        </div>
      )}

      {/* Projects Display */}
      {filteredProjects.length > 0 && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className={`bg-white rounded-2xl border-2 border-gray-200 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 cursor-pointer ${
                viewMode === 'list' ? 'flex' : ''
              }`}
            >
              {viewMode === 'grid' ? (
                // Grid View
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${
                          project.status === 'active' ? 'bg-emerald-500' : 
                          project.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-700">{project.type}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{project.name}</h3>
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="text-sm">{project.location}</span>
                      </div>
                    </div>
                    <div className="text-3xl">{project.icon}</div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-gray-600">
                        <Target className="w-4 h-4 mr-2" />
                        <span className="text-sm">{project.area} ha</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        <span className="text-sm">{project.farmers} farmers</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Carbon Credits</span>
                      <span className="font-bold text-gray-900">{project.carbon_credits} tCO₂</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-linear-to-r from-emerald-400 to-green-500 rounded-full" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectClick(project.id);
                      }}
                      className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ) : (
                // List View
                <div className="flex-1 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">{project.icon}</div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{project.name}</h3>
                        <div className="flex items-center text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span className="text-sm">{project.location}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{project.carbon_credits} tCO₂</div>
                        <div className="text-sm text-gray-600">Credits</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {project.status}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: project.id, name: project.name });
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center space-x-8 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      <span>{project.area} hectares</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{project.farmers} farmers</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Started {formatDate(project.start_date)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredProjects.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevPage}
            disabled={pagination.offset === 0}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Showing {pagination.offset + 1} - {pagination.offset + filteredProjects.length}
          </span>
          <button
            onClick={handleNextPage}
            disabled={filteredProjects.length < pagination.limit}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading.isFetching && !errors.fetch && filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🌱</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-600 mb-6">Try adjusting your filters or create a new project</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Create Your First Project
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      {deleteTarget && (
        <DeleteProjectDialog
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}