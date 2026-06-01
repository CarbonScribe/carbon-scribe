'use client';

import React, { useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store/store';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { HealthStatus } from '@/lib/store/health/health.types';

const POLL_INTERVAL_MS = 30_000;

function getStatusConfig(status: HealthStatus) {
    switch (status) {
        case 'Healthy':
            return {
                color: 'bg-green-100 text-green-800 border-green-200',
                icon: <CheckCircle className="w-6 h-6 text-green-600" />, 
            };
        case 'Degraded':
            return {
                color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
            };
        case 'Unhealthy':
            return {
                color: 'bg-red-100 text-red-800 border-red-200',
                icon: <XCircle className="w-6 h-6 text-red-600" />,
            };
        default:
            return {
                color: 'bg-gray-100 text-gray-800 border-gray-200',
                icon: <HelpCircle className="w-6 h-6 text-gray-600" />,
            };
    }
}

function formatUpdatedAt(timestamp: string | undefined) {
    if (!timestamp) {
        return 'Unknown';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleString();
}

export default function SystemStatusBanner() {
    const detailedStatus = useStore((state) => state.detailedStatus);
    const isLoading = useStore((state) => state.healthLoading.isFetchingStatus);
    const statusError = useStore((state) => state.healthErrors.status);
    const fetchDetailedStatus = useStore((state) => state.fetchDetailedStatus);

    useEffect(() => {
        fetchDetailedStatus();
        const interval = window.setInterval(fetchDetailedStatus, POLL_INTERVAL_MS);
        return () => {
            window.clearInterval(interval);
        };
    }, [fetchDetailedStatus]);

    if (isLoading) {
        return (
            <div className="w-full p-4 rounded-lg bg-gray-100 animate-pulse text-gray-500">
                Checking system status...
            </div>
        );
    }

    if (statusError) {
        return (
            <div className="w-full p-4 rounded-lg border bg-red-50 text-red-800 border-red-200 flex items-center gap-4">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                    <h3 className="font-semibold text-lg">Unable to load system health</h3>
                    <p className="text-sm opacity-80">{statusError}</p>
                </div>
            </div>
        );
    }

    if (!detailedStatus) {
        return (
            <div className="w-full p-4 rounded-lg border bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-4">
                <HelpCircle className="w-6 h-6 text-gray-600" />
                <div>
                    <h3 className="font-semibold text-lg">System health is unavailable</h3>
                    <p className="text-sm opacity-80">No health snapshot is currently available.</p>
                </div>
            </div>
        );
    }

    const status = detailedStatus.overallStatus ?? 'Unknown';
    const affectedServicesCount = Math.max(0, detailedStatus.totalServicesCount - detailedStatus.healthyServicesCount);
    const statusConfig = useMemo(() => getStatusConfig(status), [status]);
    const updatedAtText = formatUpdatedAt(detailedStatus.timestamp);

    return (
        <div className={`w-full p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${statusConfig.color}`}>
            <div className="flex items-center gap-4">
                {statusConfig.icon}
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] font-semibold opacity-80">Overall Status</p>
                    <h3 className="font-semibold text-lg">{status}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full sm:w-auto">
                <div>
                    <p className="text-sm opacity-80">Active alerts</p>
                    <p className="font-semibold text-base">{detailedStatus.activeAlertsCount}</p>
                </div>
                <div>
                    <p className="text-sm opacity-80">Affected services</p>
                    <p className="font-semibold text-base">{affectedServicesCount}</p>
                </div>
                <div>
                    <p className="text-sm opacity-80">Healthy services</p>
                    <p className="font-semibold text-base">{detailedStatus.healthyServicesCount}/{detailedStatus.totalServicesCount}</p>
                </div>
            </div>

            <div className="text-sm opacity-80">
                <p>Last updated</p>
                <p className="font-medium">{updatedAtText}</p>
            </div>
        </div>
    );
}
