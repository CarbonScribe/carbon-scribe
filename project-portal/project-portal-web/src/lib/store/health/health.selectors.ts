import { StoreState } from '../store';
import { HealthStatus, AlertSeverity } from './health.types';

// Memoized selectors can be used directly or within components.
// Here we provide helper functions that take the state and return transformed data.

export const selectOverallHealthStatus = (state: StoreState): HealthStatus => {
    return state.detailedStatus?.overallStatus || 'Unknown';
};

export const selectActiveAlerts = (state: StoreState) => {
    return state.alerts.filter((alert) => !alert.acknowledged);
};

export const selectAcknowledgedAlerts = (state: StoreState) => {
    return state.alerts.filter((alert) => alert.acknowledged);
};

export const selectCriticalAlertsCount = (state: StoreState) => {
    return state.alerts.filter((a) => !a.acknowledged && a.severity === 'Critical').length;
};

export const selectServiceStatusCounts = (state: StoreState) => {
    return state.services.reduce(
        (acc, service) => {
            acc[service.status] = (acc[service.status] || 0) + 1;
            return acc;
        },
        { Healthy: 0, Degraded: 0, Unhealthy: 0, Unknown: 0 } as Record<HealthStatus, number>
    );
};
