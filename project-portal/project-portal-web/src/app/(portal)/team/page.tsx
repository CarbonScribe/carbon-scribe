// File: app/team/page.tsx
'use client';

import { useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Calendar,
  Award,
  Shield,
  Clock,
  MessageSquare,
  Video,
  FileText,
  TrendingUp,
  Filter,
  Search,
  Download,
  Share2,
  Plus,
  AlertCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import TeamMembersList from '@/components/collaboration/TeamMembersList';
import PendingInvitationsList from '@/components/collaboration/PendingInvitationsList';
import InviteUserModal from '@/components/collaboration/InviteUserModal';
import type { Project } from '@/lib/store/projects/projects.types';

// ── Static sections (will be wired to backend in later issues) ────────────────

const communityStats = [
  { label: 'Training Sessions Completed', value: '42', change: '+8%', icon: Award },
  { label: 'Local Jobs Created', value: '89', change: '+24%', icon: TrendingUp },
  { label: 'Women Participation', value: '64%', change: '+15%', icon: Shield },
];

const upcomingEvents = [
  { id: 1, title: 'Soil Health Workshop', date: 'Apr 15, 2024', time: '10:00 AM', location: 'Nairobi Center', attendees: 24 },
  { id: 2, title: 'Carbon Credit Training', date: 'Apr 20, 2024', time: '2:00 PM', location: 'Virtual', attendees: 56 },
  { id: 3, title: 'Tree Planting Day', date: 'Apr 25, 2024', time: '8:00 AM', location: 'Amazon Site', attendees: 45 },
  { id: 4, title: 'Quarterly Review Meeting', date: 'May 5, 2024', time: '11:00 AM', location: 'Virtual', attendees: 18 },
];

// ── Skeleton loader ────────────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const TeamPage = () => {
  const [activeTab, setActiveTab] = useState('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const {
    projects,
    projectsLoading,
    selectedProject,
    setSelectedProject,
    clearSelectedProject,
    members,
    invitations,
    isLoadingMembers,
    errorMembers,
    canManage,
  } = useTeamMembers();

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  const handleProjectChange = (projectId: string) => {
    if (!projectId) {
      clearSelectedProject();
      return;
    }
    const project = projects.find((p: Project) => p.id === projectId);
    if (project) setSelectedProject(project);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Team & Community</h1>
            <p className="text-emerald-100 opacity-90">Manage your project team and community engagement</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={!selectedProject}
              className="flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedProject ? 'Select a project first' : 'Invite a member'}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Invite Member
            </button>
            <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </button>
          </div>
        </div>
      </div>

      {/* Community Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dynamic: real member count */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {isLoadingMembers ? (
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                ) : (
                  members.length
                )}
              </div>
              <div className="text-sm text-gray-600">
                {selectedProject ? `Members in ${selectedProject.name}` : 'Team Members'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Static stats (wired in future issues) */}
        {communityStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm font-medium text-emerald-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                {stat.change} from last quarter
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Team Members */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                <p className="text-gray-600">Manage your project team and collaborators</p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search team members..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>

                {/* Project selector – populated from real project store */}
                <div className="relative flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-600 shrink-0" />
                  <div className="relative">
                    <select
                      value={selectedProject?.id ?? ''}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      disabled={projectsLoading}
                      className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      <option value="">
                        {projectsLoading ? 'Loading projects…' : 'Select a project'}
                      </option>
                      {projects.map((p: Project) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              {['members', 'invitations', 'permissions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium capitalize ${
                    activeTab === tab
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                  {tab === 'invitations' && pendingInvitations.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                      {pendingInvitations.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Members */}
            {activeTab === 'members' && (
              <>
                {/* No project selected */}
                {!selectedProject && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="font-medium text-gray-700 mb-1">No project selected</p>
                    <p className="text-sm">Use the dropdown above to choose a project and load its team members.</p>
                  </div>
                )}

                {/* Loading */}
                {selectedProject && isLoadingMembers && <TeamSkeleton />}

                {/* Error */}
                {selectedProject && !isLoadingMembers && errorMembers && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMembers}</span>
                  </div>
                )}

                {/* Members list */}
                {selectedProject && !isLoadingMembers && !errorMembers && (
                  <TeamMembersList
                    projectId={selectedProject.id}
                    canManage={canManage}
                  />
                )}
              </>
            )}

            {/* Tab: Invitations */}
            {activeTab === 'invitations' && (
              <>
                {!selectedProject ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                    <Mail className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="font-medium text-gray-700 mb-1">No project selected</p>
                    <p className="text-sm">Select a project to view pending invitations.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
                      {canManage && (
                        <button
                          onClick={() => setShowInviteModal(true)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </button>
                      )}
                    </div>
                    <PendingInvitationsList projectId={selectedProject.id} />
                  </div>
                )}
              </>
            )}

            {/* Tab: Permissions */}
            {activeTab === 'permissions' && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                <Shield className="w-12 h-12 mb-3 text-gray-200" />
                <p className="font-medium">Role &amp; permissions management coming soon</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column – Community & Events */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Upcoming Events</h3>
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                    <div className="text-sm font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                      {event.date}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      {event.time} • {event.location}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {event.attendees} attending
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <Video className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <MessageSquare className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded-lg">
                          <Share2 className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-6 py-3 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
              View All Events
            </button>
          </div>

          {/* Community Resources */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Community Resources</h3>
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="space-y-4">
              {[
                { title: 'Training Manuals', count: 12, icon: '📚', color: 'bg-blue-100 text-blue-700' },
                { title: 'Safety Protocols', count: 8, icon: '🛡️', color: 'bg-emerald-100 text-emerald-700' },
                { title: 'Best Practices', count: 24, icon: '⭐', color: 'bg-amber-100 text-amber-700' },
                { title: 'Regulatory Guides', count: 6, icon: '📋', color: 'bg-purple-100 text-purple-700' },
              ].map((resource, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${resource.color} mr-3`}>
                      <span className="text-xl">{resource.icon}</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{resource.title}</div>
                      <div className="text-sm text-gray-600">{resource.count} documents</div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <h3 className="font-bold text-xl mb-4">Team Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <MessageSquare className="w-5 h-5 mr-3" />
                  <span>Send Group Message</span>
                </div>
                <Plus className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <Video className="w-5 h-5 mr-3" />
                  <span>Schedule Team Meeting</span>
                </div>
                <Calendar className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-3" />
                  <span>Recognize Achievement</span>
                </div>
                <Award className="w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-3" />
                  <span>Share Progress Report</span>
                </div>
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invite user modal */}
      {selectedProject && (
        <InviteUserModal
          projectId={selectedProject.id}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};

export default TeamPage;
