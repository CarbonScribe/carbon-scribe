import apiClient from '@/lib/api/apiClient';
import {
    SystemStatusSnapshot,
    ServiceHealthCheck,
    SystemMetric,
    SystemAlert,
    ServiceDependency
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

export const fetchUptimeApi = async (): Promise<any> => {
    const response = await apiClient.get<any>('/health/uptime');
    return response.data;
};
