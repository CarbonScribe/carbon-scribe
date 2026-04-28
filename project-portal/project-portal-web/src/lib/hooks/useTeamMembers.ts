'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/store';
import { ROLES_CAN_MANAGE } from '@/lib/store/collaboration/collaboration.types';

/**
 * Hook that manages team member data for a selected project.
 *
 * - Bootstraps the projects list from the store on first mount.
 * - Fetches members and invitations whenever the selected project changes.
 * - Derives `canManage` based on the current user's role in the project.
 */
export function useTeamMembers() {
  // ── Projects ────────────────────────────────────────────────────────────────
  const projects = useStore((s) => s.projects);
  const projectsLoading = useStore((s) => s.loading.isFetching);
  const selectedProject = useStore((s) => s.selectedProject);
  const setSelectedProject = useStore((s) => s.setSelectedProject);
  const clearSelectedProject = useStore((s) => s.clearSelectedProject);
  const fetchProjects = useStore((s) => s.fetchProjects);

  // ── Collaboration state ──────────────────────────────────────────────────────
  const members = useStore((s) => s.members);
  const invitations = useStore((s) => s.invitations);
  const isLoadingMembers = useStore((s) => s.collaborationLoading.members);
  const isLoadingInvitations = useStore((s) => s.collaborationLoading.invitations);
  const errorMembers = useStore((s) => s.collaborationErrors.members);
  const errorInvitations = useStore((s) => s.collaborationErrors.invitations);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const fetchMembers = useStore((s) => s.fetchMembers);
  const fetchInvitations = useStore((s) => s.fetchInvitations);
  const removeMember = useStore((s) => s.removeMember);
  const inviteUser = useStore((s) => s.inviteUser);
  const resetCollaborationState = useStore((s) => s.resetCollaborationState);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const currentUser = useStore((s) => s.user);

  // Bootstrap project list if not yet loaded
  useEffect(() => {
    if (projects.length === 0 && !projectsLoading) {
      fetchProjects();
    }
  }, [projects.length, projectsLoading, fetchProjects]);

  // Fetch members + invitations whenever the selected project changes
  useEffect(() => {
    if (selectedProject?.id) {
      fetchMembers(selectedProject.id);
      fetchInvitations(selectedProject.id);
    } else {
      resetCollaborationState();
    }
  }, [selectedProject?.id, fetchMembers, fetchInvitations, resetCollaborationState]);

  // Derive manage permission from the current user's membership role
  const currentUserMember = currentUser
    ? members.find((m) => m.user_id === currentUser.id)
    : null;
  const canManage = currentUserMember
    ? (ROLES_CAN_MANAGE as readonly string[]).includes(currentUserMember.role)
    : false;

  return {
    // Project context
    projects,
    projectsLoading,
    selectedProject,
    setSelectedProject,
    clearSelectedProject,

    // Team data
    members,
    invitations,

    // Loading states
    isLoadingMembers,
    isLoadingInvitations,

    // Error states
    errorMembers,
    errorInvitations,

    // Actions
    fetchMembers,
    fetchInvitations,
    removeMember,
    inviteUser,

    // Permissions
    canManage,
  };
}
