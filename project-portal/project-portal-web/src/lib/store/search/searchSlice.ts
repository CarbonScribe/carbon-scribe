// Search Slice for Zustand Store

import { StateCreator } from 'zustand';
import type {
  SearchSlice,
  SearchFilters,
  SortField,
  SortOrder,
  SavedSearch,
  GeoPoint,
  RecentSearch,
} from './search.types';
import { searchProjects, searchNearbyProjects, fetchSuggestions, syncSearchIndex } from './search.api';

const MAX_RECENT_SEARCHES = 10;
const MAX_SAVED_SEARCHES = 20;

const initialSearchFilters: SearchFilters = {};

export const createSearchSlice: StateCreator<SearchSlice> = (set, get) => ({
  // Initial state
  query: '',
  results: [],
  totalResults: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: 12,
  searchFilters: initialSearchFilters,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  isLoading: false,
  error: null,
  suggestions: [],
  isLoadingSuggestions: false,
  facets: null,
  recentSearches: [],
  savedSearches: [],
  nearbyResults: [],
  userLocation: null,

  // Core search actions
  search: async (query?: string) => {
    const state = get();
    const searchQuery = query !== undefined ? query : state.query;

    set({ isLoading: true, error: null, query: searchQuery });

    try {
      const response = await searchProjects({
        q: searchQuery,
        page: state.currentPage,
        pageSize: state.pageSize,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        filters: state.searchFilters,
      });

      set({
        results: response.hits,
        totalResults: response.total,
        totalPages: response.totalPages,
        facets: response.facets,
        isLoading: false,
      });

      // Add to recent searches
      if (searchQuery) {
        get().addRecentSearch(searchQuery, response.total);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false,
        results: [],
        totalResults: 0,
      });
    }
  },

  searchNearby: async (lat: number, lon: number, distance: number = 50) => {
    const state = get();

    set({ isLoading: true, error: null });

    try {
      const response = await searchNearbyProjects({
        lat,
        lon,
        distance,
        q: state.query,
        page: state.currentPage,
        pageSize: state.pageSize,
        filters: state.searchFilters,
      });

      set({
        nearbyResults: response.hits,
        results: response.hits,
        totalResults: response.total,
        totalPages: response.totalPages,
        facets: response.facets,
        isLoading: false,
        userLocation: { lat, lon },
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Nearby search failed',
        isLoading: false,
        nearbyResults: [],
      });
    }
  },

  clearSearch: () => {
    set({
      query: '',
      results: [],
      totalResults: 0,
      totalPages: 0,
      currentPage: 1,
      facets: null,
      nearbyResults: [],
      error: null,
    });
  },

  // Filter actions
  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters, currentPage: 1 });
    get().search();
  },

  addFilter: (key: keyof SearchFilters, value: string | number | string[] | number[]) => {
    const state = get();
    const currentFilters = { ...state.searchFilters } as Record<string, unknown>;

    if (Array.isArray(value)) {
      const existingArray = (currentFilters[key] as unknown[]) || [];
      currentFilters[key] = [...existingArray, ...value];
    } else {
      const existingArray = (currentFilters[key] as unknown[]) || [];
      if (!existingArray.includes(value)) {
        currentFilters[key] = [...existingArray, value];
      }
    }

    set({ searchFilters: currentFilters as SearchFilters, currentPage: 1 });
    get().search();
  },

  removeFilter: (key: keyof SearchFilters, value?: string | number) => {
    const state = get();
    const currentFilters = { ...state.searchFilters } as Record<string, unknown>;

    if (value !== undefined) {
      const currentValue = currentFilters[key] as unknown[] | undefined;
      if (Array.isArray(currentValue)) {
        const filtered = currentValue.filter((v) => v !== value);
        if (filtered.length > 0) {
          currentFilters[key] = filtered;
        } else {
          delete currentFilters[key];
        }
      }
    } else {
      delete currentFilters[key];
    }

    set({ searchFilters: currentFilters as SearchFilters, currentPage: 1 });
    get().search();
  },

  clearFilters: () => {
    set({ searchFilters: {}, currentPage: 1 });
    get().search();
  },

  // Sorting actions
  setSorting: (sortBy: SortField, sortOrder: SortOrder) => {
    set({ sortBy, sortOrder, currentPage: 1 });
    get().search();
  },

  // Pagination actions
  setPage: (page: number) => {
    set({ currentPage: page });
    get().search();
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, currentPage: 1 });
    get().search();
  },

  // Saved searches
  saveSearch: (name: string) => {
    const state = get();
    const newSavedSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      query: state.query,
      filters: { ...state.searchFilters },
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      createdAt: new Date().toISOString(),
    };

    const updatedSavedSearches = [newSavedSearch, ...state.savedSearches].slice(
      0,
      MAX_SAVED_SEARCHES
    );
    set({ savedSearches: updatedSavedSearches });

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedSearches', JSON.stringify(updatedSavedSearches));
    }
  },

  loadSavedSearch: (savedSearch: SavedSearch) => {
    set({
      query: savedSearch.query,
      searchFilters: savedSearch.filters,
      sortBy: savedSearch.sortBy || 'createdAt',
      sortOrder: savedSearch.sortOrder || 'desc',
      currentPage: 1,
    });
    get().search();
  },

  deleteSavedSearch: (id: string) => {
    const state = get();
    const updatedSavedSearches = state.savedSearches.filter((s: SavedSearch) => s.id !== id);
    set({ savedSearches: updatedSavedSearches });

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('savedSearches', JSON.stringify(updatedSavedSearches));
    }
  },

  // Recent searches
  addRecentSearch: (query: string, resultCount: number) => {
    const state = get();
    const newRecentSearch: RecentSearch = {
      id: crypto.randomUUID(),
      query,
      timestamp: new Date().toISOString(),
      resultCount,
    };

    // Remove duplicate if exists
    const filteredRecentSearches = state.recentSearches.filter(
      (s: RecentSearch) => s.query !== query
    );
    const updatedRecentSearches = [newRecentSearch, ...filteredRecentSearches].slice(
      0,
      MAX_RECENT_SEARCHES
    );

    set({ recentSearches: updatedRecentSearches });

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentSearches', JSON.stringify(updatedRecentSearches));
    }
  },

  clearRecentSearches: () => {
    set({ recentSearches: [] });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('recentSearches');
    }
  },

  // Typeahead
  fetchSuggestions: async (query: string) => {
    if (!query || query.length < 2) {
      set({ suggestions: [], isLoadingSuggestions: false });
      return;
    }

    set({ isLoadingSuggestions: true });

    try {
      const suggestions = await fetchSuggestions(query);
      set({ suggestions, isLoadingSuggestions: false });
    } catch {
      set({ suggestions: [], isLoadingSuggestions: false });
    }
  },

  clearSuggestions: () => {
    set({ suggestions: [] });
  },

  // Geospatial
  setUserLocation: (location: GeoPoint) => {
    set({ userLocation: location });
  },

  clearNearbyResults: () => {
    set({ nearbyResults: [], userLocation: null });
  },

  // Index sync (admin)
  syncIndex: async () => {
    set({ isLoading: true, error: null });

    try {
      await syncSearchIndex();
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Index sync failed',
        isLoading: false,
      });
    }
  },
});

// Helper function to load persisted data
export const loadPersistedSearchData = (): Partial<SearchSlice> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const savedSearchesJson = localStorage.getItem('savedSearches');
    const recentSearchesJson = localStorage.getItem('recentSearches');

    return {
      savedSearches: savedSearchesJson ? JSON.parse(savedSearchesJson) : [],
      recentSearches: recentSearchesJson ? JSON.parse(recentSearchesJson) : [],
    };
  } catch {
    return {};
  }
};
