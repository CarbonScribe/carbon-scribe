export type HealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy' | 'Unknown';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';

export interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  timestamp: string;
  durationMs: number;
  error?: string;
}

export interface ServiceHealthCheck {
  serviceId: string;
  serviceName: string;
  status: HealthStatus;
  lastCheck: string;
  uptimePercentage: number;
  results: HealthCheckResult[];
}

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  sourceIndicator: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ServiceDependency {
  sourceId: string;
  targetId: string;
  type: string;
  status: HealthStatus;
  latencyMs: number;
}

export interface UptimeStat {
  period: string;
  value: number;
}

export interface SystemStatusSnapshot {
  overallStatus: HealthStatus;
  timestamp: string;
  activeAlertsCount: number;
  healthyServicesCount: number;
  totalServicesCount: number;
  uptimeStats: UptimeStat[];
}

export interface MaintenanceEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export interface HealthSlice {
  // State
  detailedStatus: SystemStatusSnapshot | null;
  services: ServiceHealthCheck[];
  metrics: SystemMetric[];
  alerts: SystemAlert[];
  dependencies: ServiceDependency[];
  uptimeStats: UptimeStat[] | null;
  maintenanceEvents: MaintenanceEvent[];

  healthLoading: {
    isFetchingStatus: boolean;
    isFetchingServices: boolean;
    isFetchingMetrics: boolean;
    isFetchingAlerts: boolean;
    isFetchingDependencies: boolean;
    isAcknowledgingAlert: boolean;
    isFetchingUptime: boolean;
    isFetchingMaintenance: boolean;
  };
  healthErrors: {
    status: string | null;
    services: string | null;
    metrics: string | null;
    alerts: string | null;
    dependencies: string | null;
    acknowledge: string | null;
    uptime: string | null;
    maintenance: string | null;
  };

  // Actions
  fetchDetailedStatus: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchMetrics: (timeRange?: string) => Promise<void>;
  fetchAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string, adminId: string) => Promise<boolean>;
  fetchDependencies: () => Promise<void>;
  fetchUptimeStats: () => Promise<void>;
  fetchMaintenanceSchedule: () => Promise<void>;
  clearHealthData: () => void;
}