import { StateCreator } from 'zustand';
import type { HealthSlice } from './health.types';
import {
    fetchDetailedStatusApi,
    fetchServicesApi,
    fetchMetricsApi,
    fetchAlertsApi,
    acknowledgeAlertApi,
    fetchDependenciesApi,
    fetchUptimeApi,
} from './health.api';
import { AxiosError } from 'axios';

const initialState = {
    detailedStatus: null,
    services: [],
    metrics: [],
    alerts: [],
    dependencies: [],
    uptimeStats: null,
    healthLoading: {
        isFetchingStatus: false,
        isFetchingServices: false,
        isFetchingMetrics: false,
        isFetchingAlerts: false,
        isFetchingDependencies: false,
        isAcknowledgingAlert: false,
    },
    healthErrors: {
        status: null,
        services: null,
        metrics: null,
        alerts: null,
        dependencies: null,
        acknowledge: null,
    },
};

function getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        return error.response?.data?.error || error.message || 'An unexpected error occurred';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
}

export const createHealthSlice: StateCreator<HealthSlice> = (set, get) => ({
    ...initialState,

    fetchDetailedStatus: async () => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isFetchingStatus: true },
            healthErrors: { ...state.healthErrors, status: null },
        }));
        try {
            const data = await fetchDetailedStatusApi();
            set((state) => ({
                detailedStatus: data,
                healthLoading: { ...state.healthLoading, isFetchingStatus: false },
            }));
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isFetchingStatus: false },
                healthErrors: { ...state.healthErrors, status: getErrorMessage(error) },
            }));
        }
    },

    fetchServices: async () => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isFetchingServices: true },
            healthErrors: { ...state.healthErrors, services: null },
        }));
        try {
            const data = await fetchServicesApi();
            set((state) => ({
                services: data,
                healthLoading: { ...state.healthLoading, isFetchingServices: false },
            }));
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isFetchingServices: false },
                healthErrors: { ...state.healthErrors, services: getErrorMessage(error) },
            }));
        }
    },

    fetchMetrics: async (timeRange?: string) => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isFetchingMetrics: true },
            healthErrors: { ...state.healthErrors, metrics: null },
        }));
        try {
            const data = await fetchMetricsApi(timeRange);
            set((state) => ({
                metrics: data,
                healthLoading: { ...state.healthLoading, isFetchingMetrics: false },
            }));
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isFetchingMetrics: false },
                healthErrors: { ...state.healthErrors, metrics: getErrorMessage(error) },
            }));
        }
    },

    fetchAlerts: async () => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isFetchingAlerts: true },
            healthErrors: { ...state.healthErrors, alerts: null },
        }));
        try {
            const data = await fetchAlertsApi();
            set((state) => ({
                alerts: data,
                healthLoading: { ...state.healthLoading, isFetchingAlerts: false },
            }));
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isFetchingAlerts: false },
                healthErrors: { ...state.healthErrors, alerts: getErrorMessage(error) },
            }));
        }
    },

    fetchDependencies: async () => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isFetchingDependencies: true },
            healthErrors: { ...state.healthErrors, dependencies: null },
        }));
        try {
            const data = await fetchDependenciesApi();
            set((state) => ({
                dependencies: data,
                healthLoading: { ...state.healthLoading, isFetchingDependencies: false },
            }));
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isFetchingDependencies: false },
                healthErrors: { ...state.healthErrors, dependencies: getErrorMessage(error) },
            }));
        }
    },

    fetchUptimeStats: async () => {
        try {
            const data = await fetchUptimeApi();
            set({ uptimeStats: data });
        } catch (error) {
            console.error('Failed to fetch uptime stats:', getErrorMessage(error));
        }
    },

    acknowledgeAlert: async (id: string, adminId: string) => {
        set((state) => ({
            healthLoading: { ...state.healthLoading, isAcknowledgingAlert: true },
            healthErrors: { ...state.healthErrors, acknowledge: null },
        }));
        try {
            const updatedAlert = await acknowledgeAlertApi(id, adminId);
            set((state) => ({
                alerts: state.alerts.map((a) => (a.id === id ? updatedAlert : a)),
                healthLoading: { ...state.healthLoading, isAcknowledgingAlert: false },
            }));
            return true;
        } catch (error) {
            set((state) => ({
                healthLoading: { ...state.healthLoading, isAcknowledgingAlert: false },
                healthErrors: { ...state.healthErrors, acknowledge: getErrorMessage(error) },
            }));
            return false;
        }
    },

    clearHealthData: () => set({ ...initialState }),
});
