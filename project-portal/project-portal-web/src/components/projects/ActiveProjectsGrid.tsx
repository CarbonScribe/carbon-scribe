'use client';

import { useState } from 'react';
import { MapPin, Calendar, Target, Users, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import ProjectLoadingSkeleton from './ProjectLoadingSkeleton';
import CreateProjectModal from './CreateProjectModal';
import DeleteProjectDialog from './DeleteProjectDialog';

const ActiveProjectsGrid = () => {
  const projects = useStore((state) => state.projects);
  const loading = useStore((state) => state.loading);
  const errors = useStore((state) => state.errors);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Loading state
  if (loading.isFetching && projects.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
        </div>
        <ProjectLoadingSkeleton count={3} />
      </div>
    );
  }

  // Error state
  if (errors.fetch && projects.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">Unable to load projects</p>
          <p className="text-sm text-gray-500">{errors.fetch}</p>
        </div>
      </div>
    );
  }

  // Format the start_date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-linear-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center"
          >
            <span>New Project</span>
            <ArrowUpRight className="w-4 h-4 ml-2" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-gray-600 mb-4">No projects yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group border-2 border-gray-200 hover:border-emerald-300 rounded-xl p-5 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer"
              >
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          project.status === 'active'
                            ? 'bg-emerald-500'
                            : project.status === 'completed'
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {project.type}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      {project.name}
                    </h3>
                  </div>
                  <div className="text-2xl">{project.icon}</div>
                </div>

                {/* Project Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="text-sm">{project.location}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      Started {formatDate(project.start_date)}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Target className="w-4 h-4 mr-2" />
                    <span className="text-sm">{project.area} hectares</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm">{project.farmers} farmers</span>
                  </div>
                </div>

                {/* Progress & Carbon Stats */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Carbon Generated</span>
                    <span className="font-bold text-gray-900">
                      {project.carbon_credits} tCO₂
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-emerald-400 to-green-500 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
                    Monitor
                  </button>
                  <button className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors text-sm">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Projects */}
        {projects.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <button className="text-emerald-600 font-medium hover:text-emerald-700 flex items-center justify-center gap-2 mx-auto">
              <span>View All Projects</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

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
    </>
  );
};

export default ActiveProjectsGrid;