import apiClient from '@/lib/api/apiClient';
import {
    SystemStatusSnapshot,
    ServiceHealthCheck,
    SystemMetric,
    SystemAlert,
    ServiceDependency,
    UptimeStat,
    MaintenanceEvent,
} from './health.types';

export const fetchDetailedStatusApi = async (): Promise<SystemStatusSnapshot> => {
    const response = await apiClient.get<SystemStatusSnapshot>('/health/status/detailed');
    return response.data;
};

export const fetchServicesApi = async (): Promise<ServiceHealthCheck[]> => {
    const response = await apiClient.get<ServiceHealthCheck[]>('/health/services');
    return response.data;
};

export const fetchMetricsApi = async (timeRange?: string): Promise<SystemMetric[]> => {
    const url = timeRange ? `/health/metrics?timeRange=${timeRange}` : '/health/metrics';
    const response = await apiClient.get<SystemMetric[]>(url);
    return response.data;
};

export const fetchAlertsApi = async (): Promise<SystemAlert[]> => {
    const response = await apiClient.get<SystemAlert[]>('/health/alerts');
    return response.data;
};

export const acknowledgeAlertApi = async (id: string, adminId: string): Promise<SystemAlert> => {
    const response = await apiClient.post<SystemAlert>(`/health/alerts/${id}/acknowledge`, { adminId });
    return response.data;
};

export const fetchDependenciesApi = async (): Promise<ServiceDependency[]> => {
    const response = await apiClient.get<ServiceDependency[]>('/health/dependencies');
    return response.data;
};

/**
 * Fetch uptime statistics from the API
 * Returns an array of uptime stats for different periods (7d, 30d, 90d)
 */
export const fetchUptimeApi = async (): Promise<UptimeStat[]> => {
    const response = await apiClient.get<UptimeStat[]>('/health/uptime');
    return response.data;
};

/**
 * Fetch the scheduled maintenance calendar from the API.
 * NOTE: /health/maintenance is not yet implemented on project-portal-backend
 * (no route, model, or migration exists in internal/health as of this change).
 * This follows the naming convention of the sibling /health/* routes
 * (uptime, alerts, dependencies) and is tracked separately as a backend task.
 */
export const fetchMaintenanceScheduleApi = async (): Promise<MaintenanceEvent[]> => {
    const response = await apiClient.get<MaintenanceEvent[]>('/health/maintenance');
    return response.data;
};