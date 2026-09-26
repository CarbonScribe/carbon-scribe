import { StoreState } from '../store';
import { HealthStatus, AlertSeverity, UptimeStat } from './health.types';

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

/**
 * Select uptime stats from state
 */
export const selectUptimeStats = (state: StoreState): UptimeStat[] | null => {
    return state.uptimeStats;
};

/**
 * Select uptime for a specific period
 */
export const selectUptimeByPeriod = (state: StoreState, period: string): number | null => {
    const stats = state.uptimeStats;
    if (!stats) return null;
    const stat = stats.find((s: UptimeStat) => s.period === period);
    return stat?.value ?? null;
};

/**
 * Select overall uptime (defaults to 30d)
 */
export const selectOverallUptime = (state: StoreState): number | null => {
    return selectUptimeByPeriod(state, '30d');
};

/**
 * Select whether uptime is meeting SLA (99.9%)
 */
export const selectSlaStatus = (state: StoreState, slaTarget: number = 99.9): 'meeting' | 'violating' | 'unknown' => {
    const uptime = selectOverallUptime(state);
    if (uptime === null) return 'unknown';
    return uptime >= slaTarget ? 'meeting' : 'violating';
};

/**
 * Select uptime trend (compare 7d vs 30d)
 */
export const selectUptimeTrend = (state: StoreState): {
  direction: 'up' | 'down' | 'stable' | null;
  change: number | null;
} => {
    const uptime7d = selectUptimeByPeriod(state, '7d');
    const uptime30d = selectUptimeByPeriod(state, '30d');
    
    if (uptime7d === null || uptime30d === null) {
        return { direction: null, change: null };
    }
    
    const change = uptime7d - uptime30d;
    const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable';
    
    return { direction, change };
};