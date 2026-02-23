'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Trees,
  Coins,
  Droplets,
  Leaf,
  Share2,
  Edit,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store/store';
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog';
import TeamMembersList from '@/components/collaboration/TeamMembersList';
import PendingInvitationsList from '@/components/collaboration/PendingInvitationsList';
import InviteUserModal from '@/components/collaboration/InviteUserModal';
import ActivityTimeline from '@/components/collaboration/ActivityTimeline';
import CommentSection from '@/components/collaboration/CommentSection';
import TaskBoard from '@/components/collaboration/TaskBoard';
import ResourceLibrary from '@/components/collaboration/ResourceLibrary';
import { ROLES_CAN_MANAGE } from '@/lib/store/collaboration/collaboration.types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const fetchProjectById = useStore((state) => state.fetchProjectById);
  const selectedProject = useStore((state) => state.selectedProject);
  const loading = useStore((state) => state.loading);
  const errors = useStore((state) => state.errors);

  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const setCurrentProjectId = useStore((s) => s.setCurrentProjectId);
  const resetCollaborationState = useStore((s) => s.resetCollaborationState);
  const fetchMembers = useStore((s) => s.fetchMembers);
  const fetchInvitations = useStore((s) => s.fetchInvitations);
  const members = useStore((s) => s.members);

  // Fetch project on mount
  useEffect(() => {
    if (projectId) {
      fetchProjectById(projectId);
    }
  }, [projectId, fetchProjectById]);

  // Collaboration: set project context and fetch team data when project is loaded
  useEffect(() => {
    if (!projectId || !selectedProject) return;
    setCurrentProjectId(projectId);
    fetchMembers(projectId);
    fetchInvitations(projectId);
    return () => {
      resetCollaborationState();
    };
  }, [projectId, selectedProject?.id, setCurrentProjectId, resetCollaborationState, fetchMembers, fetchInvitations]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (loading.isFetching) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <span className="ml-3 text-gray-600 font-medium">Loading project details...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (errors.fetch) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Projects
        </button>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to load project</h2>
          <p className="text-gray-600 mb-4">{errors.fetch}</p>
          <button
            onClick={() => fetchProjectById(projectId)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No project found
  if (!selectedProject) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h2>
        <button 
          onClick={() => router.back()}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const project = selectedProject;

  // Metrics derived from project data
  const metrics = [
    { label: 'Carbon Credits', value: `${project.carbon_credits} tCO₂`, icon: Coins, change: `${project.progress}%` },
    { label: 'Area Covered', value: `${project.area} ha`, icon: Trees, change: 'Active' },
    { label: 'Farmers Involved', value: `${project.farmers}`, icon: Users, change: 'Enrolled' },
    { label: 'Progress', value: `${project.progress}%`, icon: Leaf, change: project.status },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Projects
        </button>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </button>
        </div>
      </div>

      {/* Project Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{project.icon}</div>
              <div>
                <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-sm mb-2">
                  {project.type}
                </div>
                <h1 className="text-3xl font-bold">{project.name}</h1>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6 text-emerald-100">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                <span>{project.location}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                <span>Started {formatDate(project.start_date)}</span>
              </div>
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                <span>{project.farmers} farmers</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 md:mt-0">
            <div className="text-right">
              <div className="text-2xl font-bold">{project.carbon_credits} tCO₂</div>
              <div className="text-emerald-100">Carbon Credits Generated</div>
            </div>
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-white text-emerald-700 rounded-full font-medium">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                project.status === 'active' ? 'bg-emerald-500 animate-pulse' :
                project.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />
              {project.status.toUpperCase()} PROJECT
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {['overview', 'monitoring', 'documents', 'financing', 'team', 'activity', 'comments', 'tasks', 'resources'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-medium capitalize ${
                activeTab === tab 
                  ? 'text-emerald-600 border-b-2 border-emerald-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div key={index} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-emerald-600">{metric.change}</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                      <div className="text-sm text-gray-600">{metric.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Description & Details */}
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Project Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Project Type</span>
                      <span className="font-medium text-gray-900">{project.type}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Area</span>
                      <span className="font-medium text-gray-900">{project.area} hectares</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Start Date</span>
                      <span className="font-medium text-gray-900">{formatDate(project.start_date)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Created</span>
                      <span className="font-medium text-gray-900">{formatDate(project.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Last Updated</span>
                      <span className="font-medium text-gray-900">{formatDate(project.updated_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Project Progress</h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Overall Progress</span>
                        <span className="font-bold text-gray-900">{project.progress}%</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                      <div className="bg-emerald-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-emerald-700">{project.carbon_credits}</div>
                        <div className="text-sm text-emerald-600">Credits Generated</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{project.farmers}</div>
                        <div className="text-sm text-blue-600">Farmers Enrolled</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="text-center py-12">
              <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Monitoring Dashboard</h3>
              <p className="text-gray-600">Real-time monitoring data will be available here once sensors are connected.</p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="text-center py-12">
              <Edit className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Project Documents</h3>
              <p className="text-gray-600">No documents uploaded yet. Upload project documents to get started.</p>
            </div>
          )}

          {activeTab === 'financing' && (
            <div className="text-center py-12">
              <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Financing Overview</h3>
              <p className="text-gray-600">Financing details and carbon credit tokenization info will appear here.</p>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Team</h3>
                {members.some((m) => (ROLES_CAN_MANAGE as readonly string[]).includes(m.role)) && (
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                  >
                    Invite member
                  </button>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Pending invitations</h4>
                <PendingInvitationsList projectId={project.id} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Members</h4>
                <TeamMembersList projectId={project.id} canManage={members.some((m) => (ROLES_CAN_MANAGE as readonly string[]).includes(m.role))} />
              </div>
              <InviteUserModal projectId={project.id} isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />
            </div>
          )}

          {activeTab === 'activity' && <ActivityTimeline projectId={project.id} />}
          {activeTab === 'comments' && <CommentSection projectId={project.id} />}
          {activeTab === 'tasks' && <TaskBoard projectId={project.id} />}
          {activeTab === 'resources' && <ResourceLibrary projectId={project.id} />}
        </div>
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <DeleteProjectDialog
          projectId={project.id}
          projectName={project.name}
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            router.push('/projects');
          }}
        />
      )}
    </div>
  );
}