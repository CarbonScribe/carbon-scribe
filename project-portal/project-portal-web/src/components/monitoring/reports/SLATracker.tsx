'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { ShieldCheck, Target } from 'lucide-react';
import { HEALTH_CONSTANTS, SLA_TARGET as BASE_SLA_TARGET } from '@/lib/constants/health.constants';

/**
 * Single source of truth for the SLA target compliance threshold.
 * Resolves process.env.NEXT_PUBLIC_SLA_TARGET dynamically with fallback to HEALTH_CONSTANTS.DEFAULT_SLA_TARGET (99.9).
 */
export const getSlaTarget = (): number => {
    const envVal = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SLA_TARGET : undefined;
    if (envVal) {
        const parsed = parseFloat(envVal);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
            return parsed;
        }
    }
    return BASE_SLA_TARGET;
};

export const SLA_TARGET = BASE_SLA_TARGET;

export interface SLATrackerProps {
    /** Optional SLA target override percentage */
    target?: number;
}

export default function SLATracker({ target }: SLATrackerProps = {}) {
    const stats = useStore(state => {
        const detailed = state.detailedStatus?.uptimeStats;
        if (detailed && detailed.length > 0) return detailed;
        const direct = state.uptimeStats;
        if (direct && direct.length > 0) return direct;
        return detailed ?? direct ?? null;
    });

    const isFetchingStatus = useStore(state => state.healthLoading?.isFetchingStatus ?? false);
    const isFetchingUptime = useStore(state => state.healthLoading?.isFetchingUptime ?? false);
    const isLoading = isFetchingStatus || isFetchingUptime;

    const statusError = useStore(state => state.healthErrors?.status ?? null);
    const uptimeError = useStore(state => state.healthErrors?.uptime ?? null);
    const error = uptimeError || statusError;

    const effectiveTarget = target ?? getSlaTarget();

    // Error state when fetch fails and no cached data is available
    if (error && !stats) {
        return (
            <div
                className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col justify-center"
                data-testid="sla-tracker-error"
                role="alert"
            >
                <h3 className="font-medium text-gray-800 border-b pb-2 mb-4">SLA Compliance</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center flex-1 flex flex-col justify-center items-center">
                    <p className="text-red-700 text-sm font-medium">Failed to load SLA compliance data</p>
                    <p className="text-red-500 text-xs mt-1">{error}</p>
                </div>
            </div>
        );
    }

    // Loading skeleton while uptime stats are fetching or not yet loaded
    if (isLoading || !stats) {
        return (
            <div
                className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col justify-center"
                data-testid="sla-tracker-skeleton"
                role="status"
                aria-label="Loading SLA compliance data"
                aria-busy="true"
            >
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4 border-b pb-2" />
                <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                    <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3 w-20 bg-gray-200 rounded" />
                            <div className="h-7 w-24 bg-gray-200 rounded" />
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-3 w-20 bg-gray-200 rounded" />
                            <div className="h-7 w-24 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
                <div className="mt-4 h-12 bg-gray-100 rounded-md animate-pulse" />
            </div>
        );
    }

    const stat30d = stats.find(s => s.period === '30d');
    const overallUptime = stat30d?.value;

    // Empty state when 30d uptime stat is missing
    if (overallUptime === undefined) {
        return (
            <div
                className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col justify-center"
                data-testid="sla-tracker-empty"
                role="status"
            >
                <h3 className="font-medium text-gray-800 border-b pb-2 mb-4">SLA Compliance</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center flex-1 flex flex-col justify-center items-center">
                    <Target className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-gray-600 text-sm font-medium">No 30-day uptime data available</p>
                    <p className="text-gray-400 text-xs mt-1">Uptime metrics are required to calculate SLA compliance.</p>
                </div>
            </div>
        );
    }

    const isMeetingSla = overallUptime >= effectiveTarget;

    return (
        <div
            className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col justify-center"
            data-testid="sla-tracker"
            role="region"
            aria-label="SLA Compliance"
        >
            <h3 className="font-medium text-gray-800 border-b pb-2 mb-4">SLA Compliance</h3>
            <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Target className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Target SLA</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1" data-testid="target-sla-value">
                            {effectiveTarget.toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div className={`w-full md:w-1/2 p-4 rounded-lg flex items-center gap-4 border ${isMeetingSla ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <ShieldCheck className={`w-6 h-6 ${isMeetingSla ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                        <div className={`text-xs uppercase tracking-wider font-semibold ${isMeetingSla ? 'text-green-800' : 'text-red-800'}`}>Current SLA</div>
                        <div className={`text-2xl font-bold mt-1 ${isMeetingSla ? 'text-green-700' : 'text-red-700'}`} data-testid="current-sla-value">
                            {overallUptime.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 p-3 rounded-md text-sm text-blue-800 flex items-start gap-2">
                <div className="mt-0.5 font-bold text-blue-600">i</div>
                <p>SLA is calculated based on total downtime aggregated across all tier-1 microservices minus scheduled maintenance windows.</p>
            </div>
        </div>
    );
}
