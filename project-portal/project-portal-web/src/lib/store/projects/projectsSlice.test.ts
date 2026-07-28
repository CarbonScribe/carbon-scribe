import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProjectsSlice } from "./projectsSlice";
import type { ProjectsSlice, Project } from "./projects.types";
import * as api from "./projects.api";

vi.mock("./projects.api", () => ({
  fetchProjectsApi: vi.fn(),
  fetchProjectByIdApi: vi.fn(),
  createProjectApi: vi.fn(),
  updateProjectApi: vi.fn(),
  deleteProjectApi: vi.fn(),
}));

vi.mock("@/lib/utils/toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

const mockApi = vi.mocked(api);

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Test Project",
  type: "Reforestation",
  location: "Kenya",
  area: 10,
  start_date: "2024-01-01",
  farmers: 5,
  carbon_credits: 100,
  progress: 50,
  icon: "🌱",
  status: "active",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  ...overrides,
});

describe("ProjectsSlice - stale-while-revalidate", () => {
  let slice: ProjectsSlice;
  let mockSet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSet = vi.fn((update) => {
      if (typeof update === "function") {
        const next = update(slice);
        Object.assign(slice, next);
      } else {
        Object.assign(slice, update);
      }
    });
    slice = createProjectsSlice(mockSet, () => slice, {} as any);
  });

  it("cache miss: fetches from the API and populates the cache", async () => {
    mockApi.fetchProjectsApi.mockResolvedValue({ projects: [makeProject()] });

    await slice.fetchProjects(10, 0);

    expect(mockApi.fetchProjectsApi).toHaveBeenCalledTimes(1);
    expect(slice.projects).toHaveLength(1);
    expect(slice.projectsCache["10:0"]).toBeDefined();
    expect(slice.lastFetchedAt).not.toBeNull();
    expect(slice.loading.isFetching).toBe(false);
  });

  it("cache hit: serves cached data without calling the API or blocking the UI", async () => {
    const cachedProject = makeProject({ id: "cached-1" });
    slice.projectsCache = {
      "10:0": { projects: [cachedProject], fetchedAt: Date.now() },
    };

    await slice.fetchProjects(10, 0);

    expect(mockApi.fetchProjectsApi).not.toHaveBeenCalled();
    expect(slice.projects[0].id).toBe("cached-1");
    expect(slice.loading.isFetching).toBe(false);
  });

  it("stale cache: serves cached data immediately, then refreshes in the background", async () => {
    const staleProject = makeProject({ id: "stale-1" });
    const freshProject = makeProject({ id: "fresh-1" });
    const staleTimestamp = Date.now() - 6 * 60 * 1000; // older than the 5-minute TTL

    slice.projectsCache = {
      "10:0": { projects: [staleProject], fetchedAt: staleTimestamp },
    };

    let resolveApiCall!: (value: { projects: Project[] }) => void;
    const apiPromise = new Promise<{ projects: Project[] }>((resolve) => {
      resolveApiCall = resolve;
    });
    mockApi.fetchProjectsApi.mockReturnValue(apiPromise as any);

    await slice.fetchProjects(10, 0);

    expect(slice.projects[0].id).toBe("stale-1");
    expect(slice.loading.isFetching).toBe(false);
    expect(slice.loading.isRefreshing).toBe(true);

    resolveApiCall({ projects: [freshProject] });
    await apiPromise;
    await Promise.resolve();

    expect(slice.projects[0].id).toBe("fresh-1");
    expect(slice.loading.isRefreshing).toBe(false);
    expect(slice.projectsCache["10:0"].projects[0].id).toBe("fresh-1");
  });

  it("manual refresh: forces a full reload with loading state even when cache is fresh", async () => {
    const cachedProject = makeProject({ id: "cached-1" });
    const freshProject = makeProject({ id: "fresh-1" });
    slice.projectsCache = {
      "10:0": { projects: [cachedProject], fetchedAt: Date.now() },
    };
    slice.pagination = { limit: 10, offset: 0, total: 1 };
    mockApi.fetchProjectsApi.mockResolvedValue({ projects: [freshProject] });

    await slice.refreshProjects();

    expect(mockApi.fetchProjectsApi).toHaveBeenCalledWith(10, 0);
    expect(slice.projects[0].id).toBe("fresh-1");
  });

  it("invalidates the cache after creating a project", async () => {
    slice.projectsCache = {
      "10:0": { projects: [makeProject()], fetchedAt: Date.now() },
    };
    mockApi.createProjectApi.mockResolvedValue(makeProject({ id: "new-1" }));

    await slice.createProject({ name: "New", type: "Reforestation", location: "Kenya", area: 5 });

    expect(slice.projectsCache).toEqual({});
    expect(slice.lastFetchedAt).toBeNull();
  });

  it("invalidates the cache after updating a project", async () => {
    slice.projects = [makeProject({ id: "p1" })];
    slice.projectsCache = {
      "10:0": { projects: [makeProject({ id: "p1" })], fetchedAt: Date.now() },
    };
    mockApi.updateProjectApi.mockResolvedValue(makeProject({ id: "p1", name: "Updated" }));

    await slice.updateProject("p1", { name: "Updated" });

    expect(slice.projectsCache).toEqual({});
  });

  it("invalidates the cache after deleting a project", async () => {
    slice.projects = [makeProject({ id: "p1" })];
    slice.projectsCache = {
      "10:0": { projects: [makeProject({ id: "p1" })], fetchedAt: Date.now() },
    };
    mockApi.deleteProjectApi.mockResolvedValue(undefined as any);

    await slice.deleteProject("p1");

    expect(slice.projectsCache).toEqual({});
  });
});