import { useStore } from '../store';
import type { Project, ProjectStats } from './projects.types';

/**
 * Select computed project statistics from the store.
 */
export function useProjectStats(): ProjectStats {
  const projects = useStore((state) => state.projects);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  return {
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    completedProjects: completedProjects.length,
    totalCarbonCredits: projects.reduce((sum, p) => sum + p.carbon_credits, 0),
    totalArea: projects.reduce((sum, p) => sum + p.area, 0),
    totalFarmers: projects.reduce((sum, p) => sum + p.farmers, 0),
    averageProgress:
      projects.length > 0
        ? Math.round(
            projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
          )
        : 0,
  };
}

/** The projects list already contains the current server-filtered page. */
export function useFilteredProjects(): Project[] {
  return useStore((state) => state.projects);
}

/**
 * Select a single project by ID from the projects array.
 */
export function useProjectById(id: string): Project | undefined {
  return useStore((state) => state.projects.find((p) => p.id === id));
}
